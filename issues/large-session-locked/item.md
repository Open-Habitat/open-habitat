---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: high
preparation: ready
lane: large-session
lane_seq: 1
---

# A conversation over 32 MiB cannot be continued, renamed or archived

## Description

Kaisa's main conversation on Birch (`06ebe951…`, hapanjuurikirja, since
31.10.) is **35 153 416 bytes**: 379 valid JSONL lines, 14 of them over 1 MiB
(images). The daemon caps native history at `maxLegacyHistoryFile = 32 << 20`
(`internal/daemon/history_linux.go`, also `close_linux.go`,
`history_tail_linux.go`), so the session's state is not `readable`, and every
operation that requires a readable history refuses: continue (409 at 13:58:30
7.11.), archive (`archive_linux.go`), naming (`history_title` 409 at 14:00:20)
and close. A long conversation with images reaches 32 MiB in a week of normal
use, and then it is stuck with no explanation. (Read from her home with her
consent, Jari 7.11.)

Fix so a large native session keeps working: archive, naming and continue must
not need to read the whole file (naming appends a native line; archive is an
annotation; the revision check can use size/mtime/tail), and history reading
pages from the tail instead of refusing past a fixed size. If some bound must
stay, it is well above realistic sizes, and hitting it is explained to the
person with what to do, never a bare error.

## Acceptance Criteria

- [ ] a synthetic 40 MiB session (images) can be continued, renamed and archived; history opens from the end; tests at the daemon boundary
