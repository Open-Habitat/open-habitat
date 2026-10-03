---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
lane: pi-event-design
---

# Design every Pi event block

## Jari's request (2026-10-03)

After every distinct Pi event and the data it carries had been mapped (@catalog-pi-events), each of them gets its own, separate design in Jari's design agent. Jari confirmed that the design starts from Pi's original typed shapes, not from today's flattened browser history.

## Goal

A design for every visually distinct thing Pi can put into a conversation, so that the browser can show a Pi session as faithfully as Pi itself knows it. Each block is designed on its own, with all of its states, rather than as a generic card that fits everything.

## Input

[The event catalogue](../catalog-pi-events/analysis.md) and [its tool shapes](../catalog-pi-events/analysis-tools.md) give the exact fields per event at the pinned Pi 0.85.1. Its proposed blocks are the starting list:

1. User prompt: text and image attachments.
2. Assistant answer: ordered Markdown/code text, with the model, usage, stop reason and error as a footer.
3. Thinking: expanded, collapsed and redacted.
4. Tool call: a shared shell with tool-specific argument views for read, bash, edit (diff), write, grep, find, ls and arbitrary extension tools, including streaming arguments.
5. Tool result: text, image or diff; success or error; truncated output with access to the full output.
6. Local `!` / `!!` command: command, incremental output, exit or cancel, truncation, excluded-from-context marker.
7. Compaction and branch summary.
8. Session markers: model and thinking-level changes, session name, label or bookmark.
9. Extension message, notification, status and widget (only visible ones).
10. Blocking extension question: select, confirm, input and editor, with cancel and timeout.
11. Error and recovery: abort, length limit, deferred, automatic retry, compaction retry, and an unknown native payload.
12. Queue and turn activity: steering and follow-up queue, progress, settlement.

The design work may merge or split these where the catalogue's data shows a better boundary; each change is explained. A call and its result for one tool use are one coherent thing for the reader, not separate conversations.

## Work

Prepare a design package with the repository's `design-package` skill: a `REQUEST.md` that explains each block from its typed shape, with realistic anonymised example payloads (short and very long, streaming and settled, success and error, desktop and phone), and the current production components and tokens it should build on. Keep the final brief in this issue's directory and deliver the zip to Jari. Jari runs the design rounds; the returned drafts and handoff go to `design-system/drafts/v3/` and are compared with production in the synthetic lab as described in AGENTS-WORKFLOW.md "UI work".

## Acceptance criteria

- [ ] Every block in the list (or its explained merge/split) has a design covering its states on desktop and phone.
- [ ] The designs use Pi's typed fields as delivered by @carry-typed-pi-events, not today's `HistoryEntry` kinds.
- [ ] Drafts and handoff are in `design-system/drafts/v3/`; the follow-up rendering work is filed from them.
