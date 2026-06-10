"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtcNestStreamer = exports.RtspNestStreamer = exports.NestStreamer = void 0;
exports.getStreamer = getStreamer;
const dgram_1 = require("dgram");
const werift_1 = require("werift");
const Traits = __importStar(require("./sdm/Traits"));
const pick_port_1 = require("pick-port");
class NestStreamer {
    token;
    camera;
    log;
    constructor(log, camera) {
        this.log = log;
        this.camera = camera;
    }
}
exports.NestStreamer = NestStreamer;
class RtspNestStreamer extends NestStreamer {
    async initialize() {
        const streamInfo = await this.camera.generateStream();
        this.token = streamInfo.streamExtensionToken;
        return {
            args: '-analyzeduration 15000000 -probesize 100000000 -i ' + streamInfo.streamUrls.rtspUrl
        };
    }
    async teardown() {
        await this.camera.stopStream(this.token);
    }
}
exports.RtspNestStreamer = RtspNestStreamer;
class WebRtcNestStreamer extends NestStreamer {
    udp;
    pc;
    async initialize() {
        this.udp = (0, dgram_1.createSocket)("udp4");
        this.pc = new werift_1.RTCPeerConnection({
            bundlePolicy: "max-bundle",
            codecs: {
                audio: [
                    new werift_1.RTCRtpCodecParameters({
                        mimeType: "audio/opus",
                        clockRate: 48000,
                        channels: 2,
                    })
                ],
                video: [
                    new werift_1.RTCRtpCodecParameters({
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
            type: 'udp',
            ip: '0.0.0.0',
            reserveTimeout: 15
        };
        const audioPort = await (0, pick_port_1.pickPort)(options);
        const audioTransceiver = this.pc.addTransceiver("audio", { direction: "recvonly" });
        audioTransceiver.onTrack.subscribe((track) => {
            audioTransceiver.sender.replaceTrack(track);
            track.onReceiveRtp.once(() => {
                this.log.info("Received first WebRTC audio packet from Nest", this.camera.getDisplayName());
            });
            track.onReceiveRtp.subscribe((rtp) => {
                this.udp.send(rtp.serialize(), audioPort, "127.0.0.1");
            });
        });
        let videoPort = await (0, pick_port_1.pickPort)(options);
        while (Math.abs(videoPort - audioPort) < 2) {
            videoPort = await (0, pick_port_1.pickPort)(options);
        }
        const videoTransceiver = this.pc.addTransceiver("video", { direction: "recvonly" });
        videoTransceiver.onTrack.subscribe((track) => {
            videoTransceiver.sender.replaceTrack(track);
            track.onReceiveRtp.once(() => {
                this.log.info("Received first WebRTC video packet from Nest", this.camera.getDisplayName());
            });
            track.onReceiveRtp.subscribe((rtp) => {
                this.udp.send(rtp.serialize(), videoPort, "127.0.0.1");
            });
            // Start sending PLI immediately on connection and periodically every 2 seconds
            let pliInterval;
            const sendPli = () => {
                if (track.ssrc) {
                    this.log.debug(`Sending PLI for video track SSRC ${track.ssrc}`, this.camera.getDisplayName());
                    videoTransceiver.receiver.sendRtcpPLI(track.ssrc);
                }
            };
            const startPli = () => {
                if (!pliInterval) {
                    sendPli();
                    pliInterval = setInterval(sendPli, 2000);
                }
            };
            if (this.pc.connectionState === "connected") {
                startPli();
            }
            else {
                this.pc.connectionStateChange.subscribe((state) => {
                    if (state === "connected") {
                        startPli();
                    }
                });
            }
            this.pc.connectionStateChange.subscribe((state) => {
                if (state === "closed" || state === "failed") {
                    if (pliInterval) {
                        clearInterval(pliInterval);
                        pliInterval = undefined;
                    }
                }
            });
        });
        this.pc.createDataChannel('dataSendChannel', { id: 1 });
        let offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        const streamInfo = await this.camera.generateStream(offer.sdp);
        this.token = streamInfo.mediaSessionId;
        await this.pc.setRemoteDescription({
            type: 'answer',
            sdp: streamInfo.answerSdp
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
        };
    }
    async teardown() {
        try {
            await this.camera.stopStream(this.token);
        }
        catch (error) {
            this.log.error('Error stopping camera stream.', error);
        }
        try {
            await this.pc?.close();
        }
        catch (error) {
            this.log.error('Error closing peer connection.', error);
        }
        try {
            await this.udp?.close();
        }
        catch (error) {
            this.log.error('Error closing UDP connection to FFMpeg.', error);
        }
    }
}
exports.WebRtcNestStreamer = WebRtcNestStreamer;
async function getStreamer(log, camera) {
    if ((await camera.getVideoProtocol()) === Traits.ProtocolType.WEB_RTC) {
        return new WebRtcNestStreamer(log, camera);
    }
    else {
        return new RtspNestStreamer(log, camera);
    }
}
//# sourceMappingURL=NestStreamer.js.map