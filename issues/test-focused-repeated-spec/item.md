---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: conductor
status: open
priority: normal
lane: unlaned
preparation: ready
---

# test-focused.sh runs only the last of several --spec arguments

## Description

Reported by the `conversation-archive-list` worker 9.11.2026:
`scripts/test-focused.sh --spec a --spec b` silently runs only `b`. A worker
believing it ran every touched spec can land an untested one. Support several
`--spec` arguments, or refuse a repeat with a clear error.

## Acceptance Criteria

- [ ] Repeated `--spec` runs each named spec, or is refused; a test covers it.
