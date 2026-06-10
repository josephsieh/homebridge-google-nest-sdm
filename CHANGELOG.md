# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
## [2.0.24] - 2026-06-10

### Fixed
- **RTP sequence gap compensation:** Padding-only probe packets (dropped before relay) still consume sequence numbers, causing ffmpeg to report `RTP: missed N packets` and stall its jitter buffer. Now subtract the running count of dropped padding packets from forwarded sequence numbers so ffmpeg sees a contiguous sequence while preserving relative ordering of genuine packets.
- **Audio SSRC fallback:** Google's SDM answer SDP declares audio as `msid:virtual-6666` / `a=ssrc:6666`, but the actual audio RTP may arrive under a different SSRC. werift's `RtpRouter` silently drops any packet whose SSRC is not in its registration table. This release wraps `routeRtp` to intercept unregistered-SSRC packets, log them once per new SSRC, and relay Opus PT 96 packets directly to ffmpeg.
- **REMB observability:** The REMB send was previously wrapped in a silent catch. Now logs a debug line on first successful send and a warning with the error message on first failure, making it possible to confirm REMB is actually reaching the camera.
- **PLI backoff:** Reduced PLI frequency from a fixed 2 s interval to 2 s for the first 10 s, then 10 s. Each PLI forces a full IDR keyframe, consuming a large fraction of the ~640 kbps budget and suppressing frame rate. Faster initial rate ensures the first IDR arrives promptly; slower ongoing rate reduces encoder overhead.

### Changed
- **Recommended config:** Remove `"vEncoder": "copy"` from plugin config and use the default libx264 transcode. Copy mode passes through H.264 High profile while HomeKit negotiates MAIN/3.1, and the stream starts with decode errors (corrupt pre-IDR frames). Transcode decodes and re-encodes to clean MAIN/3.1 at the negotiated parameters. 640×360 transcode is trivial for the NAS CPU.

---
## [2.0.23] - 2026-06-09

### Fixed
- **WebRTC REMB Feedback (main fix):** Send RTCP Receiver Estimated Maximum Bitrate (REMB) packets at 2 Mbps every second via `videoTransceiver.receiver.dtlsTransport.sendRtcp`. Google's SDM server negotiates `goog-remb` (not `transport-cc`) for bandwidth estimation; without REMB the camera stays at its ~300 kbps floor and floods the stream with padding-only probe packets indefinitely.
- **Padding-only RTP filtering:** Skip relaying RTP packets with `payload.length === 0` (libwebrtc bandwidth-probe packets that werift strips to empty). Relaying these caused 3,500+ `Empty H.264 RTP packet` warnings in ffmpeg, jitter-buffer churn (`max delay reached`), and eventual demux timeout.
- **PLI timing:** Start sending Picture Loss Indication on the first received video RTP packet (rather than gated on `connectionState === "connected"`, which was arriving 15 s after media began flowing due to IPv6 ICE candidate checks). First-packet timing guarantees DTLS/SRTP is up so the PLI is actually delivered.
- **ICE IPv6 disabled:** Set `iceUseIpv6: false` in `RTCPeerConnection` config to avoid slow ICE checks against Google's IPv6 host candidates, which caused the `connected` state to arrive 15 s late.
- **Removed spurious `replaceTrack` calls:** Deleted `sender.replaceTrack(track)` echo-back on the recvonly audio and video transceivers, which served no purpose.

---
## [2.0.22] - 2026-06-09

### Fixed
- **WebRTC PLI SSRC Alignment:** Extracted the remote video stream SSRC directly from the negotiated SDP Answer. The plugin now sends PLI requests targeting both the SDP negotiated SSRC and the receiver-detected track SSRC. This prevents Google's Nest servers from ignoring keyframe requests due to SSRC mismatches, resolving frozen streams.

---
## [2.0.21] - 2026-06-09

### Fixed
- **FFmpeg WebRTC Initialization Latency:** Reduced WebRTC stream `analyzeduration` to 1 second and `probesize` to 1MB, and added `-fflags nobuffer -flags low_delay`. This prevents FFmpeg from blocking/hanging for 30 seconds waiting for silent/missing audio packets, enabling instant startup.

---
## [2.0.20] - 2026-06-09

### Fixed
- **SDM Trait Correctness:** Renamed `maxImageResolution` to `maxVideoResolution` in the `CameraLiveStream` interface to align with Google's official schema definition.
- **Copy Mode Resolution Mismatch:** Configured `getResolutions` to advertise standard WebRTC resolutions (`640x360` for landscape, `480x640` for portrait) in `copy` mode to eliminate resolution mismatch failures in Apple Home.

---
## [2.0.19] - 2026-06-09

### Fixed
- **WebRTC PLI Deadlock:** Send Picture Loss Indicator (PLI) requests immediately upon connection (and every 2 seconds after) to resolve startup deadlocks with Google's Nest SDM server.
- **First RTP Arrival Logging:** Added informational logs indicating when the first audio and video RTP packets are received from Nest.
- **FFmpeg Error & Debug Logging:** Unconditionally forward FFmpeg stderr to `log.debug` to bypass argv checking. Additionally, buffer and output the last 50 stderr lines as `log.error` if FFmpeg exits with an error code.

---
## [2.0.18] - 2026-06-09

### Added
- **Diagnostics:** Restored WebRTC Connection State transition logs to aid in diagnosing streaming connection health.

---
## [2.0.17] - 2026-06-09

### Added
- **Features:** Added the `localIp` configuration parameter to manually override the network IP address advertised to HomeKit. This resolves "No Response" issues on setups with multiple network interfaces or virtual network adapters (like Synology open vSwitch or Docker bridges) where the plugin auto-detects the wrong network interface.
- **Diagnostics:** Added a log message that prints the local IP address being used when preparing a stream.

---
## [2.0.16] - 2026-06-09

### Reverted
- **Diagnostics:** Reverted all verbose FFmpeg error logging, SDP input printing, and WebRTC connection state logs to restore the original cleaner log output.

---
## [2.0.15] - 2026-06-09

### Changed
- **Diagnostics:** Forward live FFmpeg stderr lines to the logger's debug level unconditionally to support standard Homebridge UI debug logging settings.

---
## [2.0.14] - 2026-06-09

### Added
- **Diagnostics:** Added logging of WebRTC Connection State transitions (e.g. `connecting`, `connected`, `failed`) to assist in identifying network connectivity issues between the plugin and Google's WebRTC servers.

---
## [2.0.13] - 2026-06-09

### Fixed
- **Camera Streaming:** Fixed a critical port allocation issue where the video and audio ports returned by `pickPort` could be consecutive. Because FFmpeg's RTP/SDP demuxer automatically binds to `port + 1` for RTCP, consecutive port assignments caused a `bind failed: Address already in use` (exit code 183) failure. The plugin now guarantees that audio and video ports are separated by at least 2 ports.

---
## [2.0.12] - 2026-06-09

### Fixed
- **Diagnostics:** Listen to the `close` event instead of the `exit` event to ensure all asynchronous `stderr` data has finished flushing before logging error diagnostics.
- **Diagnostics:** Log `stdin` and `stderr` line-by-line to prevent output truncation in the Homebridge console log parser.

---
## [2.0.11] - 2026-06-09

### Added
- **Diagnostics:** Added verbose error logging on FFmpeg stream failures, showing the full `ffmpeg` command, input stdin (SDP), and `stderr` logs automatically in the Homebridge output to aid in debugging stream launch failures.

---
## [2.0.10] - 2026-06-09

### Fixed
- **Camera Streaming:** Fixed an issue where live camera streams fail to display (black screen / no video) in the Apple Home app when the `vEncoder` option is set to `"copy"`. This was caused by two issues:
  1. Raw video parameters (`-f rawvideo -pix_fmt yuv420p -color_range mpeg`) were incorrectly appended to the FFmpeg command line even when in copy mode.
  2. A resolution mismatch between HomeKit's negotiated stream resolution and the camera's native resolution copied by FFmpeg. The plugin now automatically restricts the advertised resolutions to only the camera's native max resolution (and Apple Watch fallback) when copy mode is enabled, forcing HomeKit to negotiate the native stream resolution.

---
## [2.0.8] - 2026-06-09

### Changed
- **Documentation:** Updated repository ownership, scoped package name, and fan accessory details.

---
## [2.0.7] - 2026-06-09

### Refactored
- **Thermostat Accessory:** Extracted and simplified temperature conversion, bounds calculations, and characteristic maps from ThermostatAccessory.ts into a separate cohesive helper file ThermostatUtils.ts, raising overall cohesion and maintainability.

### Fixed
- **Event Loop & Reconnection:** Added a robust try/catch wrapper around Pub/Sub message JSON parsing and event dispatching in Api.ts. Added automatic exponential backoff reconnection attempts to handle network and Pub/Sub socket drops.
- **Camera Caching & Performance:** Implemented memory caching for camera snapshot default logo placeholders to prevent redundant file system reads in Camera.ts. Extended event-triggered image retention from 10 seconds to 5 minutes to improve snapshot loading in HomeKit.
- **Process Management:** Adjusted FfMpegProcess.ts to attempt graceful SIGTERM signals for process termination, falling back to forceful SIGKILL only if the subprocess fails to exit after 500ms.

---
## [2.0.6] - 2026-06-09

### Fixed
- **Fan Accessory:** Fixed thermostat fan control issues where toggling the fan in Apple Home had no effect or failed to sync. Implemented robust truthy value mapping for `Active` characteristic setter, added `CurrentFanState` characteristic to support proper status sync and fan animations, and added immediate UI state updates after API commands.
- **Event Sync:** Fixed a bug where incoming Pub/Sub event traits were ignored if they were not initially present in the device object at startup.

---

## [2.0.5] - 2026-06-09

### Fixed
- **Fan Accessory:** Fixed an issue where toggling the fan had no effect and the state didn't sync correctly with HomeKit. Migrated the legacy `Service.Fan` (v1) to `Service.Fanv2` (using `Active` characteristic instead of `On`), and corrected Nest SDM Fan API command parameter checks.

---

## [2.0.4] - 2026-06-09

### Changed
- Chore: Bumped version to 2.0.4.

---

## [2.0.3] - 2026-06-09

### Changed
- Chore: Upgraded `werift` WebRTC dependency to version `0.23.0`.
- Chore: Bumped version to 2.0.3.

---

## [2.0.2] - 2026-06-09

### Changed
- Chore: Updated dependencies and fixed breaking API changes in upstream libraries.
- Chore: Bumped version to 2.0.2.

---

## [2.0.1] - 2026-06-08

### Fixed
- **Diagnostics:** Improved error diagnostics during startup and event subscription.
- **Thermostat/Snapshot:** Fixed thermostat temperature correctness and camera snapshot caching logic.

### Changed
- Chore: Excluded IDE configurations (`.claude/`) and local logs from the packaged npm release file.
- Chore: Fixed the npm scope configuration to `@josephsjc`.
- Chore: Renamed package to `@josephsieh/homebridge-google-nest-sdm`.

---

## [2.0.0] - 2026-06-08

### Added
- **Homebridge v2 Support:** Upgraded the plugin architecture to comply with the Homebridge v2 specification, including Node 22+ requirements.
- **CLAUDE.md:** Added developer context guide for Claude Code.

### Changed
- Chore: Updated repository issue templates.
- Chore: Bumped version to 2.0.0.
