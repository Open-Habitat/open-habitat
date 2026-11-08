---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
lane: large-content-proto
lane_seq: 1
blocked_by: ['@recheck-button-unexplained']
preparation: ready
closed: 2026-11-08
---

# Design and prototype: graceful handling of very large conversation content

## Description

Jari 8.11.2026, after the history of a conversation stopped loading on the
test server (*Historiaa ei saada*, lone *Tarkista keskustelun tila*) once he
had tested with very large files (`recheck-button-unexplained`): agents will
sometimes handle very large files, and Habitat must behave gracefully. Where
it now jams and stops working it should (a) report the problem clearly and
correctly, at the right point, and (b) preferably not end up in a broken
state at all, or notice proactively that something is about to overflow.

Two steps:

1. Investigation (use the cause found in `recheck-button-unexplained`):
   every path where size can break a conversation — large attachments and
   images sent to Pi, large tool outputs and file reads in history, large
   offers (folders, images), native frame and history-page limits, memory on
   the host. For each: the limit today, what happens past it, and where the
   host could detect it beforehand (refuse at send, truncate or reference
   instead of inline, page history around a huge entry, warn the agent).
2. Prototype round (`AGENTS-WORKFLOW.md`): how the person sees it — a
   refusal before sending, a huge entry in history shown as a collapsed
   placeholder that still lets the rest load, a warning while the agent is
   about to read something huge, and the recovery when a conversation is
   already too heavy. Three directions, 1440 and 390, light and dark.

## Acceptance Criteria

- [x] Investigation table in result.md (path, limit, failure today, early detection).
- [x] Prototype round 1 with view offer and questions for Jari.
