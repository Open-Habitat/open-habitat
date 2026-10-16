---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: normal
lane: unlaned
collision: [issues/taskfleet-pi-extension]
preparation: ready
---

# Research: wrap Taskfleet as a Pi extension so following and run-wait notifications are automatic

Jari, 2026-10-16: would it be more sensible to wrap Taskfleet as some kind of Pi extension, so that following runs and `run wait` completion notifications happen automatically? Today agents drive `taskfleet` through processes they start themselves in their shell, and Open Habitat infers spinoffs and processes from that (`spinoff-process-duplication` exists because a `run wait` shows up as a process).

Research question and recommendation for Jari; the architecture decision is his and is recorded afterwards in an ADR. The report is `analysis.md` in this directory.

## Acceptance Criteria
- [ ] `analysis.md` answers the question with sourced findings, at least two credible positions, and a recommendation with reasons.
