import {Camera} from "./sdm/Camera";
import {GenerateRtspStream, GenerateWebRtcStream} from "./sdm/Responses";
import {createSocket, Socket} from "dgram";
import {RTCPeerConnection, RTCRtpCodecParameters, RtcpPayloadSpecificFeedback, ReceiverEstimatedMaxBitrate} from "werift";
import * as Traits from "./sdm/Traits";
import {Logger} from "homebridge";
import { pickPort } from 'pick-port';

export interface NestStream {
    args: string,
    stdin?: string
}

export abstract class NestStreamer {
    protected token: string | undefined;
    protected camera: Camera;
    protected log: Logger;

    constructor(log: Logger, camera: Camera) {
        this.log = log;
        this.camera = camera;
    }

    abstract initialize(): Promise<NestStream>;
    abstract teardown(): void;
}

export class RtspNestStreamer extends NestStreamer {
    async initialize(): Promise<NestStream> {
        const streamInfo = <GenerateRtspStream> await this.camera.generateStream();
        this.token = streamInfo.streamExtensionToken;
        return {
            args: '-analyzeduration 15000000 -probesize 100000000 -i ' + streamInfo.streamUrls.rtspUrl
        };
    }

    async teardown(): Promise<void> {
        await this.camera.stopStream(this.token!);
    }
}

// REMB target bitrate: 2 Mbps — libwebrtc canonical encoding (brMantissa << brExp = bitrate;
// brMantissa must be < 2^18 = 262144; brExp 3, brMantissa 250000 → 250000 << 3 = 2,000,000).
const REMB_BPS_EXP = 3;
const REMB_BPS_MANTISSA = 250000;

export class WebRtcNestStreamer extends NestStreamer {
    private udp: Socket | undefined;
    private pc: RTCPeerConnection | undefined;
    private remoteVideoSsrc: number | undefined;
    private rembInterval: NodeJS.Timeout | undefined;

    async initialize(): Promise<NestStream> {

        this.udp = createSocket("udp4");

        this.pc = new RTCPeerConnection({
            bundlePolicy: "max-bundle",
            iceUseIpv6: false,
            codecs: {
                audio: [
                    new RTCRtpCodecParameters({
                        mimeType: "audio/opus",
                        clockRate: 48000,
                        channels: 2,
                    })
                ],
                video: [
                    new RTCRtpCodecParameters({
                        mimeType: "video/H264",
                        clockRate: 90000,
                        rtcpFeedback: [
                            { type: "transport-cc" },
                            { type: "ccm", parameter: "fir" },
                            { type: "nack" },
                            { type: "nack", parameter: "pli" },
                            { type: "goog-remb" },
                        ],
                        parameters: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f'
                    })
                ],
            }
        });

        this.pc.connectionStateChange.subscribe((state) => {
            this.log.info(`WebRTC Connection State: ${state}`, this.camera.getDisplayName());
        });

        const options = {
          type: 'udp' as const,
          ip: '0.0.0.0',
          reserveTimeout: 15
        };
        const audioPort = await pickPort(options);

        // Shared audio relay state — used by both the werift track path and the
        // unknown-SSRC fallback so they share the same seq counter and first-packet flag.
        let audioDropped = 0;
        let audioFirstPacketLogged = false;
        const relayAudio = (rtp: any) => {
            if (rtp.payload.length === 0) { audioDropped++; return; }
            if (!audioFirstPacketLogged) {
                audioFirstPacketLogged = true;
                this.log.info("Received first WebRTC audio packet from Nest", this.camera.getDisplayName());
            }
            rtp.header.sequenceNumber = (rtp.header.sequenceNumber - audioDropped) & 0xffff;
            this.udp!.send(rtp.serialize(), audioPort, "127.0.0.1");
        };

        const audioTransceiver = this.pc.addTransceiver("audio", {direction: "recvonly"});
        audioTransceiver.onTrack.subscribe((track) => {
            track.onReceiveRtp.subscribe(relayAudio);
        });

        // Wrap werift's RTP router to catch audio packets that arrive under an SSRC
        // not registered in werift's ssrcTable (Google's "virtual-6666" audio track
        // often sends from a different real SSRC that werift silently drops).
        const router = (this.pc as any).router;
        const origRouteRtp = router.routeRtp.bind(router);
        const seenUnknownSsrcs = new Set<number>();
        router.routeRtp = (packet: any) => {
            if (!router.ssrcTable[packet.header.ssrc]) {
                if (!seenUnknownSsrcs.has(packet.header.ssrc)) {
                    seenUnknownSsrcs.add(packet.header.ssrc);
                    this.log.info(
                        `RTP with unregistered SSRC ${packet.header.ssrc}, payload type ${packet.header.payloadType}`,
                        this.camera.getDisplayName()
                    );
                }
                if (packet.header.payloadType === 96) {
                    relayAudio(packet);
                }
                return;
            }
            origRouteRtp(packet);
        };

        let videoPort = await pickPort(options);
        while (Math.abs(videoPort - audioPort) < 2) {
            videoPort = await pickPort(options);
        }
        const videoTransceiver = this.pc.addTransceiver("video", {direction: "recvonly"});
        videoTransceiver.onTrack.subscribe((track) => {
            // PLI timing: start on first received RTP packet (DTLS/SRTP confirmed up).
            // Backoff: 2 s for the first 10 s, then 10 s — each PLI forces a full IDR
            // and consumes a large fraction of the ~640 kbps budget.
            let pliInterval: NodeJS.Timeout | undefined;
            let pliCount = 0;
            const sendPli = () => {
                const ssrcsToTry = new Set<number>();
                if (track.ssrc) ssrcsToTry.add(track.ssrc);
                if (this.remoteVideoSsrc) ssrcsToTry.add(this.remoteVideoSsrc);
                for (const ssrc of ssrcsToTry) {
                    this.log.debug(`Sending PLI for video track SSRC ${ssrc}`, this.camera.getDisplayName());
                    videoTransceiver.receiver.sendRtcpPLI(ssrc);
                }
                pliCount++;
                if (pliCount === 5 && pliInterval) {
                    clearInterval(pliInterval);
                    pliInterval = setInterval(sendPli, 10000);
                }
            };
            const startPli = () => {
                if (!pliInterval) {
                    sendPli();
                    pliInterval = setInterval(sendPli, 2000);
                }
            };

            let videoDropped = 0;
            track.onReceiveRtp.once(() => {
                this.log.info("Received first WebRTC video packet from Nest", this.camera.getDisplayName());
                startPli();
            });
            track.onReceiveRtp.subscribe((rtp) => {
                if (rtp.payload.length === 0) { videoDropped++; return; }
                rtp.header.sequenceNumber = (rtp.header.sequenceNumber - videoDropped) & 0xffff;
                this.udp!.send(rtp.serialize(), videoPort, "127.0.0.1");
            });

            this.pc!.connectionStateChange.subscribe((state) => {
                if (state === "closed" || state === "failed") {
                    if (pliInterval) {
                        clearInterval(pliInterval);
                        pliInterval = undefined;
                    }
                }
            });
        });

        this.pc.createDataChannel('dataSendChannel', {id: 1});

        let offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        const streamInfo = <GenerateWebRtcStream> await this.camera.generateStream(offer.sdp);
        this.token = streamInfo.mediaSessionId;
        this.remoteVideoSsrc = parseVideoSsrc(streamInfo.answerSdp);
        await this.pc.setRemoteDescription({
            type: 'answer',
            sdp: streamInfo.answerSdp
        });

        // Send REMB every second so the Nest camera ramps its bitrate above the
        // ~300 kbps libwebrtc floor. Google's answer SDP negotiates goog-remb (not
        // transport-cc), so the sender only increases bitrate when it receives REMB.
        // werift never sends REMB automatically.
        let rembLoggedOk = false;
        const sendRemb = () => {
            if (!this.remoteVideoSsrc) return;
            try {
                const remb = new RtcpPayloadSpecificFeedback({
                    feedback: new ReceiverEstimatedMaxBitrate({
                        senderSsrc: videoTransceiver.receiver.rtcpSsrc,
                        mediaSsrc: 0,
                        ssrcNum: 1,
                        ssrcFeedbacks: [this.remoteVideoSsrc],
                        brExp: REMB_BPS_EXP,
                        brMantissa: REMB_BPS_MANTISSA,
                    }),
                });
                videoTransceiver.receiver.dtlsTransport.sendRtcp([remb]);
                if (!rembLoggedOk) {
                    rembLoggedOk = true;
                    this.log.debug("REMB send succeeded", this.camera.getDisplayName());
                }
            } catch (err: any) {
                if (!rembLoggedOk) {
                    this.log.warn(`REMB send failed: ${err?.message ?? err}`, this.camera.getDisplayName());
                }
            }
        };
        this.rembInterval = setInterval(sendRemb, 1000);

        this.pc.connectionStateChange.subscribe((state) => {
            if (state === "closed" || state === "failed") {
                if (this.rembInterval) {
                    clearInterval(this.rembInterval);
                    this.rembInterval = undefined;
                }
            }
        });

        return {
            args: `-protocol_whitelist pipe,crypto,udp,rtp,fd -analyzeduration 1000000 -probesize 1000000 -fflags nobuffer -flags low_delay -i -`,
            stdin: `v=0
o=- 0 0 IN IP4 127.0.0.1
s=-
c=IN IP4 127.0.0.1
t=0 0
m=audio ${audioPort} UDP 96
a=rtpmap:96 opus/48000/2
a=fmtp:96 minptime=10;useinbandfec=1
a=rtcp-fb:96 transport-cc
a=sendrecv
m=video ${videoPort} UDP 97
a=rtpmap:97 H264/90000
a=rtcp-fb:97 ccm fir
a=rtcp-fb:97 nack
a=rtcp-fb:97 nack pli
a=rtcp-fb:97 goog-remb
a=fmtp:97 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=sendrecv`
        }
    }

    async teardown(): Promise<void> {
        if (this.rembInterval) {
            clearInterval(this.rembInterval);
            this.rembInterval = undefined;
        }

        try {
            await this.camera.stopStream(this.token!);
        } catch (error: any) {
            this.log.error('Error stopping camera stream.', error);
        }

        try {
            await this.pc?.close();
        } catch (error: any) {
            this.log.error('Error closing peer connection.', error);
        }

        try {
            await this.udp?.close();
        } catch (error: any) {
            this.log.error('Error closing UDP connection to FFMpeg.', error);
        }
    }
}

export async function getStreamer(log: Logger, camera: Camera): Promise<NestStreamer> {
    if ((await camera.getVideoProtocol()) === Traits.ProtocolType.WEB_RTC) {
        return new WebRtcNestStreamer(log, camera);
    } else {
        return new RtspNestStreamer(log, camera);
    }
}

function parseVideoSsrc(sdp: string): number | undefined {
    const lines = sdp.split(/\r?\n/);
    let inVideoSection = false;
    for (const line of lines) {
        if (line.startsWith('m=video')) {
            inVideoSection = true;
        } else if (line.startsWith('m=')) {
            inVideoSection = false;
        }
        if (inVideoSection && line.startsWith('a=ssrc:')) {
            const match = line.match(/^a=ssrc:(\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
    }
    return undefined;
}
