# Fork Divergence Ledger & Maintenance Guide

This repository is a downstream fork of [`potmat/homebridge-google-nest-sdm`](https://github.com/potmat/homebridge-google-nest-sdm). It is maintained independently (Homebridge 2.x support, Node 22+, enhanced WebRTC resilience, fan accessory support, and status sync caching).

**Upstream remote:** `https://github.com/potmat/homebridge-google-nest-sdm.git`  
**Last synced:** `upstream/master @ f63ec2e` (upstream v1.2.24)

---

## Divergence Ledger

When merging upstream updates, use this table to quickly identify whether a difference is intentional and how to resolve conflicts.

| File / Component | Fork Behavior (`@josephsjc/...`) | Upstream Behavior (`potmat`) | Conflict Resolution Strategy |
|---|---|---|---|
| `package.json` | Scoped name `@josephsjc/homebridge-google-nest-sdm`, v2.x versioning, `files` allow-list | Unscoped name, v1.x versioning | **Keep fork** name/version/files; take upstream dependency additions/bumps. |
| `dist/` | Untracked in git (`.gitignore`, built on `npm publish`) | Tracked in git | **Drop upstream dist changes** (`git rm --cached dist/*`). Build locally via `npm run build`. |
| `src/NestStreamer.ts` (Audio) | No spurious `replaceTrack()`; sequence number renumbering on empty payload drop; router wrap fallback for unregistered SSRCs | Calls `replaceTrack()`; drops unrouted SSRCs silently | **Keep fork** audio relay, drop filter, and router wrap. |
| `src/NestStreamer.ts` (Video) | No spurious `replaceTrack()`; padding drop & seq renumbering; FIR + PLI to both SDP SSRC and track SSRC with 2s→10s backoff; REMB 4 Mbps; IPv6 disabled | Calls `replaceTrack()`; repeats FIR/PLI every 2s indefinitely; REMB 4 Mbps | **Keep fork** padding drop, backoff, and dual SSRC targeting. Incorporate upstream FIR/REMB helpers and diagnostic marks. |
| `src/NestStreamer.ts` (FFmpeg) | Uses configurable `analyzeDuration` & `probeSize` (default 15s / 100MB) with `-fpsprobesize 0 -fflags nobuffer -flags low_delay` | Same defaults with `-fpsprobesize 0` | **Take upstream** defaults with fork's low-delay flags. |
| `src/StreamingDelegate.ts` | Supports `localIp` override, `copy` mode resolution constraints, `addressOverride`, snapshot error propagation; HKSV session teardown & streamId guard | Only HKSV session teardown and streamId guard | **Keep fork** IP/copy/snapshot features alongside upstream HKSV session fixes. |
| `src/sdm/Device.ts` | `executeCommand` **rethrows** errors; 30s trait refresh coalescing; safe circular-proof rate limit detection | `executeCommand` returns `undefined`; 24h trait cache; `JSON.stringify` rate limit check | **Keep fork** error rethrow, 30s cache, and safe error stringify. |
| `src/sdm/Api.ts` | Reconnection timeout handling, outer try/catch for PubSub message handling; relation update guard | Relation update guard | **Keep fork** reconnection & error handling; ensure relation update guard is preserved. |
| `src/sdm/Camera.ts` & `src/sdm/Doorbell.ts` | Logo caching; 5-min event-image cache; `isEventStale(event, log = true)` with quiet mode in Doorbell | Stale event checking with unconditional logging | **Keep fork** caching and quiet stale check to prevent duplicate log messages. |
| `src/FfMpegProcess.ts` | 50-line stderr ring buffer for error diagnosis; empty H.264 RTP log suppression; milestone tracking | Milestone tracking; empty H.264 RTP log suppression | **Keep fork** ring buffer alongside upstream milestones and log suppression. |
| `src/ThermostatAccessory.ts` & `src/FanAccessory.ts` | Extracted `ThermostatUtils.ts`, fan control traits, validation, state sync | Basic thermostat / fan traits | **Keep fork** thermostat utilities and fan accessory logic. |
| `config.schema.json` | Adds schema entries for `showFan`, `fanDuration`, `analyzeDuration`, `probeSize` | Adds schema entries for `analyzeDuration`, `probeSize` | **Keep fork** union of all configuration fields. |

---

## Coding Conventions for Minimizing Conflict Surface

1. **Mark fork deviations with `// [fork]`:** When editing upstream-owned files, add a brief inline comment explaining the rationale so future merge resolvers know not to discard it.
2. **Prefer extracting new fork logic into dedicated helper files:** Keep changes to upstream files minimal by calling out to helper modules (e.g., `ThermostatUtils.ts`).
3. **Avoid cosmetic reformatting in upstream files:** Do not reformat indentation, reorder imports, or rewrite types in files owned by upstream unless necessary.
4. **Prefer upstream fixes when equivalent:** If upstream fixes a bug that was previously patched in the fork, adopt upstream's implementation and retire the fork-specific patch.

---

## How to Sync with Upstream

Run the automated sync helper:
```bash
npm run sync:upstream
```

This will:
1. Fetch latest changes from `upstream` without importing tags.
2. Create a temporary `sync/upstream-<date>` branch.
3. Initiate a merge and automatically clear untracked `dist/` conflicts.
4. Display any remaining conflicts in `src/` or `package.json` to resolve against this ledger.

After resolving:
```bash
npm run build
git commit
# Merge sync branch back into master and update the 'Last synced' marker in FORK.md
```
