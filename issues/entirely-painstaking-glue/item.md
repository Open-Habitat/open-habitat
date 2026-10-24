---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed in clean gate runs
source_ref: taskfleet:01m5pwash6xqdy2ckhjytkh1aa/gate-flake:personal-data-skill
originating_run: 01m5pwash6xqdy2ckhjytkh1aa
originating_run_kind: spinoff
---

# Daemon integration tests race the personal-data skill generation under gate load

## Description

Under the full clean gate's load on Alder (2026-10-24, two runs on the server-integrations-dropbox branch, which does not touch internal/daemon/integrations), tests in `internal/daemon/integrations` that read the generated personal-data skill right after a connect/login failed because the file was not there yet:

- run 1: `TestDropboxConnectSyncRestartAndRemove` — `dropbox_linux_test.go:165: skill: open .../.agents/skills/personal-data/SKILL.md: no such file or directory`
- run 2: `TestGoogleConnectSyncRestartAndRemove` (`google_linux_test.go:144`) and `TestDeviceCodeRelayBelongsToItsSession` (`integrations_linux_test.go:592: skill after login: ...`), same error

Each passes when run alone (`go test ./internal/daemon/integrations -run <name> -count=3`). The tests seem to read `~/.agents/skills/personal-data/SKILL.md` before the catalog's skill regeneration has finished, so they race the generation under CPU load. Either the tests should wait for the regeneration they depend on, or the generation is not synchronous with the operation the product claims completes it; which one needs a look at when the catalog writes the skill. Effect: the clean gate fails on an unrelated tree.
