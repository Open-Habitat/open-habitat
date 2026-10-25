---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5ek6zt9jh7v54nffsxk3ccv/observed-identical-command-duplicate
originating_run: 01m5ek6zt9jh7v54nffsxk3ccv
originating_run_kind: spinoff
closed: 2026-10-21
---

# Second identical native command can still leave three cards for two invocations

## Description

## Description

The ordinary host-backed suite observed the native-command duplicate-card defect after main's `07b8183c` fix: two identical `!!git status` invocations had two saved history cards but three total command cards. The extra card remained through the existing five-second assertion window. This is an observed regression/residual, not a confirmed cause.

## Reproduction

Run `cd web && npx playwright test`, particularly `web/tests/command-cards.spec.ts`, case `@command-cards: \`!!\` keeps the output from Pi and finishes with its exit code`. The case sends `!!git status`, checks one saved card, then sends the identical command again. At line 162 the saved-history count reached two; line 163 expected two total `command-run` cards and received three until timeout.

Observed in Taskfleet run `01m5ek6zt9jh7v54nffsxk3ccv`, after rebasing the wording/test synchronization branch onto main `6da753c8` (which includes `07b8183c`). No native-command production or command-card test code was edited by this run. Log on Alder: `/var/tmp/wording-land-integrated-ordinary.log` (300 passed, 2 failed, 3 opt-in capture skips; the other failure was an unrelated reconnect-test navigation race subsequently fixed in this worker).

The failing ordinary run wrote a trace under `test-results/command-cards--command-card-*/trace.zip` in the configured Cedar warm workspace; subsequent suites may have replaced that directory. Same-UID synthetic evidence only. Earlier single-command duplicate work is recorded by the closed @bash-card-duplicate issue. The distinguishing interaction here is the second invocation with identical text.

## Acceptance Criteria

- [x] Reproduce or capture the extra card through the second identical command's completion.
- [x] Preserve one distinct card per invocation while allowing identical command text to run twice; do not weaken the existing count/history assertions.

## Resolution

### 2026-10-21T07:40:12Z · @issuectl

Native request-ID completion now follows queued output, including EOF/reap; deterministic regressions, 10 card repeats and full browser/daemon race checks pass. Focused review completed. See result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
