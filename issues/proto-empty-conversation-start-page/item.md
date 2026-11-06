---
created: 2026-11-02
updated: 2026-11-03
type: task
reporter: jari
status: done
priority: normal
lane: proto-start-page-button
lane_seq: 1
preparation: pending
closed: 2026-11-03
---

# Prototype: a Luo aloitussivu button in the empty new conversation

## Description

Jari 2.11. (iPhone): an empty new conversation in a workspace without a
start page says "Luo aloitussivu kirjoittamalla viestikenttään
/open-habitat-start-page." He would like a *Luo aloitussivu* button there
instead, like the workspace landing card's, but prototyped first. One view:
the empty new conversation of a workspace with no start page, on phone and
desktop. Directions should differ in how the invitation sits in the empty
space (a quiet button, a card that says what the page will contain, the
button in the composer area) and what happens on press (the agent starts at
once in this conversation, or the composer is filled for the person to send).
No command name or file name on screen (`ui-text-no-internals` rule).

## Acceptance Criteria

- [ ] A prototype round with three visibly different directions and a recommendation, phone and desktop.

## Decision (Jari 3.11.)

Direction 1, **Rivi ja painike**. On press the agent **starts at once**: a
template prompt is sent and the agent continues from it in the conversation
(the person can steer from there). Questions 2 (the workspace landing's
buttons filling a chip instead of command text) and 3 (how a sent start-page
request reads in the history) were not clear in words: they get their own
visual prototype round, `proto-start-page-request-presentation`.
