---
created: 2026-10-02
updated: 2026-10-04
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-02/terminal-writes
lane: client-history
lane_seq: 70
blocked_by: ['@carry-typed-pi-events']
collision: [web/src/app/]
closed: 2026-10-04
closed_by: claude
---

# Keep terminal Pi writes in sync across open browser views

## Purpose

When Pi writes to a conversation from SSH or tmux, open browser views should
show the new messages without the user reloading the conversation. This includes
the same conversation open in two different browsers.

The daemon currently publishes events from Pi processes it controls, but does
not watch native session files for external writes. Terminal changes therefore
remain invisible to an already open view until its history is loaded again.

## Approach

Find how the daemon can notice external changes and deliver them through the
existing conversation journal. Native Pi files remain the history source, and
all connected views should converge on the same content without duplicating
messages already received from daemon-controlled Pi processes.

A daemon file watcher is Jari's preferred direction, not a settled implementation.
Assess terminal/browser concurrent use and compare that approach with a
browser-side check. Directory watching and a journal invalidation are possible
mechanisms; the choice belongs to this work.

## Expected result

An external Pi write appears in both simultaneously open browsers. Updates from
daemon-controlled Pi still reach both, and a message seen through more than one
update path appears only once.
