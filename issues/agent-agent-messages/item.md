---
created: 2026-11-26
updated: 2026-11-26
type: feature
reporter: jari
status: open
priority: normal
lane: conversation-history
lane_seq: 2
preparation: ready
---

# Agent-to-agent messages between conversations (experimental)

## Goal

Implement agent-to-agent messages between the person's conversations as decided by Jari
(issue `agent-agent-message`, design.md and rounds 1–4, decisions 24.–26.11.2026), behind an
experimental switch:

- No request/answer protocol: agents exchange equal messages with
  `open-habitat agent message create --conversation …`, optionally `--quote <message id>`.
  No runaway guard and no hop limit.
- The daemon marks every message sent through the agent route with its sender (the
  `<agent-message>` block of design.md); a message from another agent never looks like the
  person's own words, in history, queue, held/steered paths and for the receiving Pi.
- Incoming (A Kirjeet) and outgoing (A Peili) blocks with round 4's copy, direction B
  Hiljainen: icon, the other conversation's name as a link to the same message there, time
  after the name, the message, and a one-line quote only when the agent quoted; the quote row
  is hidden when the quoted message is directly above the block; a quote preview cut short
  ends with "…" so it is clear the message continues (check the existing reply-to quote does
  the same).
- The agent may leave out its own "I sent a message to …" sentence; the agent guide says the
  block shows it.
- The CLI's typed result (`agent_message_sent`: id, target, title, `conversation_url`,
  delivery, state, text, quote) drives the outgoing block; history detects it from the tool
  result, not by parsing the command line.
- Multiplayer participants see such messages as coming from "the owner's other
  conversation" without its title or link (design.md).
