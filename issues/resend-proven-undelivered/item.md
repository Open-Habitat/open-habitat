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

# Send a message again automatically when it provably never reached Pi

## Description

Jari 8.11.2026, after `send-during-restart-uncertain`: a message whose send
outcome is unknown after a daemon restart keeps blocking the tab's composer
until the tab is closed. The no-resend rule exists because, while it is
unknown whether Pi received a message, sending it again could make the agent
do the work twice (a commit, a mail, a deletion). Once it is proven that Pi
never received it, that reason is gone and the person still wants it sent.

Proven undelivered means all of: native history is readable and holds no
newer user message carrying the text, Pi's queue is empty, the agent is idle,
and the daemon has no record of the command. Then Habitat sends it again by
itself, once, and the conversation shows it as an ordinary sent message.
If the conversation has moved on meanwhile (a newer message or turn from
any tab), it is not sent; its text returns to the field instead, so a stale
instruction never lands out of context. Anything less than proof keeps
today's single warning with *Tarkista*.

## Acceptance Criteria

- [ ] Proven-undelivered send is sent again automatically once; moved-on conversation returns the text to the field; unproven stays a warning.
- [ ] Browser spec with a synthetic daemon restart before Pi takes the message; touched specs green.
