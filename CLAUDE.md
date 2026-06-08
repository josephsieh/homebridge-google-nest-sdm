# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # clean + tsc compile + copy static assets to dist/
npm run clean       # remove dist/
```

There are no tests (`npm test` exits with an error). Node >= 18 required.

TypeScript strict mode is on. Build output goes to `dist/`; `src/res/*.jpg` (snapshot placeholder images) are copied there by `copy-files`. Node >= 22 required (Homebridge 2.x).

## Architecture

This is a Homebridge dynamic platform plugin that bridges Google Nest devices to HomeKit via the [Google Smart Device Management (SDM) API](https://developers.google.com/nest/device-access).

### Layers

**Entry & Platform** (`src/index.ts`, `src/Platform.ts`)
- `Platform` implements `DynamicPlatformPlugin`. On `didFinishLaunching` it calls `discoverDevices()`, which lists Google devices, maps them to Homebridge accessory categories, and instantiates the appropriate `*Accessory` class.

**SDM API layer** (`src/sdm/`)
- `SmartDeviceManagement` (`Api.ts`) owns the OAuth2 client, the Google SDM API client, and a Google Cloud PubSub subscription for real-time events. Events are dispatched to the matching `Device` instance via `device.event()`.
- `Device` (abstract base) holds the raw SDK device object and handles trait caching (refreshed at most once per 24 h), `getTrait<T>()`, and `executeCommand<T,U>()`.
- Concrete devices: `Camera`, `Doorbell`, `Display`, `Thermostat`, `UnknownDevice`. `Doorbell` and `Display` extend `Camera`.

**Accessory layer** (`src/`)
- `CameraAccessory`, `DoorbellAccessory` set up a `CameraStreamingDelegate`/`DoorbellStreamingDelegate` and wire motion/doorbell press events from the SDM device to Homebridge characteristics.
- `ThermostatAccessory`, `FanAccessory` read/write thermostat traits and commands.
- `MotionAccessory` is a standalone motion sensor.
- `EcoMode.ts` defines a custom Homebridge characteristic for the thermostat eco mode.

**Streaming** (`src/StreamingDelegate.ts`, `src/NestStreamer.ts`, `src/HksvStreamer.ts`, `src/FfMpegProcess.ts`)
- `StreamingDelegate` (abstract, implements `CameraStreamingDelegate` + `CameraRecordingDelegate`) handles HomeKit SRTP stream negotiation and HomeKit Secure Video (HKSV) recording via `handleRecordingStreamRequest` (async generator yielding fmp4 fragments).
- `getStreamer()` inspects `CameraLiveStream` trait to decide between `RtspNestStreamer` (RTSP URL → ffmpeg) and `WebRtcNestStreamer` (WebRTC via `werift`, RTP relayed over UDP loopback to ffmpeg).
- `HksvStreamer` wraps ffmpeg to produce fragmented MP4 for HKSV.
- `FfmpegProcess` spawns and manages individual ffmpeg child processes.

### Config

`Config.ts` defines the typed config shape. Required fields: `projectId`, `clientId`, `clientSecret`, `refreshToken`, `subscriptionId`. Optional: `gcpProjectId` (defaults to `projectId` for PubSub), `vEncoder` (defaults to `libx264 -preset ultrafast -tune zerolatency`; `"copy"` skips transcoding), `showFan`, `fanDuration`.

`config.schema.json` is the Homebridge UI config schema — keep it in sync with `Config.ts` when adding fields.

**Debug mode:** pass `-D` or `--debug` to the `homebridge` CLI to enable verbose logging (`platform.debugMode`).
