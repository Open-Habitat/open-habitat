---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Allow 100 MiB of attachments per message

## Description

Jari 8.11.2026: raise the combined attachment size per message from 20 MiB
to 100 MiB, so about twenty phone photos fit (`attachment-count-limit` raised
the count to 30 and kept the 20 MiB combined prompt budget). The 20 MiB
per-file and 1 GiB directory limits stay. Change it in the browser and the
daemon wherever the combined budget is enforced (`web/src/app/attachments.ts`,
`internal/daemon/attachments_linux.go`, contracts if it is there), check that
the native image payload to Pi still works at that size (memory, request
size), and say the limit in the refusal text.

## Acceptance Criteria

- [ ] 30 files totalling up to 100 MiB send; 101 MiB is refused with the limit stated.
- [ ] Touched Go, web and attachment browser tests green.
