---
created: 2026-10-12
updated: 2026-10-13
type: improvement
status: in-progress
priority: normal
related: ['@add-conversation-recap', '@new-conversation-view']
lane: web
lane_seq: 8
collision: [web/, internal/daemon/]
preparation: ready
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

A recap should be generated automatically only after both Pi and the person
have been inactive for more than three minutes: Pi has verifiably settled, and
neither side has written a new native message (no reply, tool activity or
message from the person, steering and queued messages included) for that
interval (Jari 2026-10-13). Activity that never reaches Pi, such as reading or
an unsent draft in the browser, is not visible to the daemon and does not
count. Generation is useful only when the conversation contains
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

## Chosen presentation (prototype round 2026-10-13)

Jari chose the full card ("Kortti") over a one-line strip and a lid joined to
the field: the whole recap and its "Seuraavaksi" line sit in their own card
directly above the composer. The header reads "Tilannekatsaus", the relative
age, a dashed "uusia viestejä" mark when the conversation has moved on, and
"luotu automaattisesti" after an idle-triggered recap; refresh (two arrows)
and close are icon buttons at the right, and refresh is disabled with its
reason while Pi works. Generation shows a skeleton in place of the text. The
frozen draft is `design-system/drafts/Agentin vuoro.proto.html`, built from
`design-system/prototypes/lib/recap.*`; the round with the rejected
directions is `design-system/prototypes/rounds/2026-10-13-katsaus/`.
