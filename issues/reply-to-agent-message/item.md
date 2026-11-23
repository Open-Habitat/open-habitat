---
created: 2026-11-22
updated: 2026-11-23
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-reply-to-message
lane: reply-to-message
lane_seq: 1
preparation: pending
---

# Prototype: reply to a specific agent message (quote in the composer)

## Description

A second person on our household installation, via Jari (22.11.2026), wants to reply to a specific agent message.
Each agent message would have a small control (e.g. in a corner); pressing it
starts a reply to that message. Every message has its own id; the reply carries
a quote of the message (e.g. a bracketed/quoted reference) so the agent knows
which message is being answered. Like WhatsApp: the composer shows the start of
the quoted message above the text field, and clicking the quote scrolls up to
the original message.
Next action: a prototype round (the message control, the composer quote, what
the agent receives, jump to original).

## Decisions

### 2026-11-23T04:20:14Z · @jari

Jari 23.11.2026: direction A (quote card above the composer) is the base, but the card must follow our design system — no coloured accent bar on the left or other foreign styling. Next action: a riff round on A in our design, plus the architecture: exactly what message reaches the agent (the literal text/structure Pi receives, how the reference to the original entry is carried, what the native session records), with options and a recommendation.
