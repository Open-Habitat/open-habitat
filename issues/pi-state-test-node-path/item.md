---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: claude
status: in-progress
priority: normal
lane: unlaned
collision: [internal/daemon]
---

# TestPiRPCNativeState needs node on the restricted PATH

## Description

A follow-up to `tests-hardcode-system-node`. On Birch (2026-10-25), the full gate is green except `internal/daemon` `TestPiRPCNativeState`: `real Pi get_state: false Pi acceptance uncertain: output closed`. The test launches `pi-device-test/node_modules/.bin/pi`, a `#!/usr/bin/env node` script, with `PATH=/usr/bin:/bin`. Where node lives only in the account's PATH (`~/.local/bin`), `env` cannot find node, and Pi exits immediately. Alder hides this because it has `/usr/bin/node`.

## Acceptance Criteria

- [ ] The test launches Pi through the shared node lookup helper (resolved node plus the Pi CLI entry, as the other native tests do), keeping the restricted child PATH.
- [ ] `go test ./internal/daemon -run TestPiRPCNativeState` passes on Birch (`ssh birch`, a clone under `/var/tmp`), and the full gate passes on Alder.
