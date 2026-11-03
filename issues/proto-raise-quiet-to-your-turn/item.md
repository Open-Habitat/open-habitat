---
created: 2026-11-03
updated: 2026-11-03
type: task
reporter: jari
status: open
priority: normal
lane: proto-raise-quiet
lane_seq: 1
preparation: pending
---

# Prototype: raise a quiet conversation back to Sinun vuorosi

## Description

Jari 3.11.: a conversation in **Hiljaiset** should be possible to raise to
*Odottaa sinua* / **Sinun vuorosi** by hand, so that it joins the round and
the next-waiting banner (*Sillä aikaa* row, experimental) like a conversation
whose agent just finished. For example a button that appears on hover at the
left of a Hiljaiset row in the rail, or another way.

Riff: where the action is (hover button on the row's left edge, the row's ⋯
menu, a gesture on the phone, in the conversation's own header ⋯, a keyboard
shortcut), what it is called, how the raised row looks in Sinun vuorosi (the
same as a finished turn, or marked as raised by you), how it enters the
next-waiting round and banner and in which order, how it leaves (opening it,
replying, an explicit *Ei nyt*), whether it can also be lowered back to
Hiljaiset from Sinun vuorosi, and on which devices the raised state shows
(the seen state is per browser today; raising probably needs the host).
Today first, then three directions visibly different on the default view,
one line each at the top; phone and desktop; interactive.

## Acceptance Criteria

- [ ] A prototype round with today and three directions, desktop and phone, a recommendation and at most three questions Jari can answer by pointing at a picture.
