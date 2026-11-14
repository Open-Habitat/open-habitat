---
created: 2026-11-14
updated: 2026-11-14
type: feature
status: open
priority: normal
preparation: ready
lane: worker-ask
lane_seq: 1
---

# A path for a worker to ask its parent conversation a question

## Question (Jari 14.11.2026)

Should a worker have a way to ask its parent conversation a question while it
runs, instead of only ending its run with `success: false` and a decision in
`discussion_items`? Today the parent can message a live Pi worker
(`taskfleet run message`), but a worker cannot ask back, and a worker stuck
before its agent loop (`taskfleet-worker-trust-prompt`) is silent.

## Ideas to discuss (not decided)

- **A blocking ask as a command.** `taskfleet node ask --question … --default …
  --timeout 30m` run by the worker from its shell: works for any harness (Pi,
  Claude, Codex) because it is just a command that waits. The run raises a
  `question` attention that wakes the parent's `run wait`; the parent answers
  with `taskfleet run answer <run> …`; on timeout the worker continues with
  its stated default and records that it did.
- **A non-blocking note.** `taskfleet node note …` for "I changed X, the
  other worker may need to know": shown in the parent's check-ins and passed
  on by the parent with `run message` or the next brief.
- **Habitat.** The question appears on the worker's row in the Workers panel
  and wakes the parent conversation like a finished worker does; the person
  can answer there or let the parent agent answer.
- **Startup silence.** A worker with no agent activity N minutes after start
  is reported as stalled to the parent, so a hidden prompt cannot sit
  unnoticed.

Most of this belongs to Taskfleet; Habitat's part is showing and waking.

## Decisions

### 2026-11-14T12:58:25Z · @jari

Jari 14.11.2026: the question goes to the parent agent, which answers it and asks the person only when the person must answer. Design needed; benchmark how Raine's workmux implements worker-to-parent questions as possible architecture material.
