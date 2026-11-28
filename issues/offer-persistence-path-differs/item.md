---
created: 2026-11-28
updated: 2026-11-28
type: bug
reporter: conductor
status: open
priority: normal
provenance: chat
source_ref: chat:conductor-2711/offer-persistence-path
lane: agent-offers
preparation: ready
lane_seq: 1
---

# Offer commands report persistence at different JSON paths

## Description

An agent made a duplicate file card in a conversation (27.11.2026, CLI 0.1.9)
because the offer commands report persistence at different paths:
`open-habitat agent view offer --json` has `data.result.offer.persistence`,
while `agent file offer --json` has it only at `data.result.notice.persistence`
(the daemon's reply in `internal/daemon/fileoffers_linux.go` puts it under
`notice`, and `internal/cli/fileoffers_linux.go` reads `reply.Notice`). An
agent reading the view path got `null`, took the offer as failed and retried
with a new key.

Fix: the same field in the same place for every offer command (file, view;
notice create is separate but should be checked for consistency), keeping the
old path alongside for a transition period, with a test that pins the shape.
