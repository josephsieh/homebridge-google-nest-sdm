# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
