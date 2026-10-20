---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: conductor
status: fixed
priority: normal
lane: integrations
lane_seq: 5
collision: [internal/daemon/integrations]
closed: 2026-10-20
---

# One unknown key in integrations.json disables every integration

_Source: taskfleet:01m5ctfqbmah0hdkpnbfj0k5qm_

## Description

Observed 2026-10-20 on the test VM (pilot.249): the operator merged a google section into /opt/open-habitat/integrations.json before the Google-capable release was installed; the daemon rejected the whole file and the live catalogs lost IMAP and Dropbox availability until the key was withdrawn. An installation file shared by every user should degrade per entry: an unknown or invalid entry makes only that entry unavailable (with a logged reason), while valid entries stay available. Strict validation of known entries stays. Done: daemon test with an unknown provider key and a malformed known entry next to valid IMAP/Dropbox entries.

## Acceptance Criteria

- [x] Unknown provider keys and malformed known entries do not disable valid IMAP/Dropbox configuration.
- [x] Known entries retain strict field/type and application validation; invalid tool paths are omitted individually.
- [x] Ignored entries produce fixed-reason diagnostics without configuration keys, values or raw errors.

## Result

Configuration is decoded per provider and per tool. Whole-document JSON errors and operator-file trust failures still fail closed. The daemon supplies its integration logger to the loader. No change to executable ownership checks, Unix-user authority, credentials or installation hardening; focused self-review is proportionate. Reviewed strict decoding, semantic app validation, partial decode discard, and diagnostic redaction. No browser UI change or captures, deployment, push, or Fleetrepo changes.

Validation uses the remote Linux ARM64 runner, Go 1.27.1, on base `66cde9219b10b0d116c08e15046cf2c633f84207` with the final three Go-file changes captured (dirty input supported):

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`: passed, race-enabled; job `8bdc50f5f1537f251561b457a435ab8629e83fd71bc0c0e3a4e72092e888909c`, snapshot `9c31d671506a561495c8286cf188a4c17d7223716f2e13ac7337d27077066f6f`. Regression cases cover unknown provider + malformed Microsoft next to available IMAP/Dropbox, invalid tool paths/types, malformed tools alongside valid Google, document rejection and diagnostic redaction.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, race-enabled; job `e6d3e635ea3fdb0cb3f0a906248ae4fbb2a07c2201de8b910a0a713003ee3a87`, snapshot `c01c9b46149465eb6a0044f9ee24beb34ee1c96e725b7ada5d49b60c20468811`. Guest installed the pinned Pi SDK fixture before testing. Observer marks this snapshot stale after issue-result prose changed; no runnable inputs changed after capture.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area contracts`: passed generated drift and contract validation (56 schemas, 56 fixture files, 37 scenarios, 17 negative checks); job `ee5625e0a11bb7f3465a8e56e7ddf357d2759e3b90ba8017e1c224d767f3f377`, snapshot `289618df9a3b1480bc00f75c8dc45f7bd56c2f472592a2bf672f1b72b3b8bc43`. Same documentation-only staleness as above.
- `git diff --check`, `python3 scripts/validate-project-view.py`, `issuectl doctor --json`: passed (doctor retains existing attachment advisories).

Failure/incompletion inventory: no failed commands, tests or reviews. Full clean gate and live-server verification intentionally not run for this bounded change; the conductor deploys. Evidence does not claim native amd64 execution or distinct-UID isolation.
