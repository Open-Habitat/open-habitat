---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: open
priority: normal
related: ['@add-conversation-recap', '@new-conversation-view']
lane: web
lane_seq: 7
collision: [web/, internal/daemon/]
---

# Recap appears automatically above the composer and can be closed

On pilot.22 on 2026-10-12, Jari found the "Tilannekatsaus" card awkwardly
placed at the top of the conversation and impossible to close. Its refresh
button also blended into its background. The recap should help someone
returning to a conversation decide how to continue, close to where they write.

The card belongs directly above the composer and can be dismissed. A dismissed
card stays closed until a newer recap exists. Its header reads "Tilannekatsaus"
followed immediately by the relative age ("10 min sitten", "2 t sitten"),
with a clearly visible circular two-arrow refresh icon at the right. The icon
has an accessible label. Empty conversations have nothing to recap, as
described in [@new-conversation-view](../new-conversation-view/item.md).

A recap should be generated automatically after more than three minutes of
inactivity: Pi has verifiably settled and no new native message has arrived
for that interval. Generation is useful only when the conversation contains
something newer than the latest recap. It waits while a turn runs and occurs
once per idle period; reconnects and multiple tabs should not multiply model
calls. These conditions keep the recap relevant without interrupting work or
paying repeatedly for the same summary.

[@add-conversation-recap](../add-conversation-recap/item.md) left automatic
generation out because browser focus does not establish that Pi is idle.
This change uses daemon-observed native activity and completion, with the
existing Pi recap extension producing and storing the result. The
[conversation architecture](../../docs/architecture/conversations.md) describes
that ownership and the current trigger limitation; it should reflect the
implemented automatic behavior.

Lab evidence should cover the idle trigger and duplicate prevention across
tabs and reconnects, dismissal until a newer recap, manual refresh and the
stale indicator. Desktop and phone views should make the card's placement,
age and controls easy to understand.
