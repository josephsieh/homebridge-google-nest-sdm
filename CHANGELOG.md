# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
