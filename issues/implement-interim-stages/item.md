---
created: 2026-10-19
updated: 2026-10-19
type: feature
reporter: jari
status: open
priority: high
related: ['@proto-interim-replies']
lane: conversation-view
lane_seq: 2
collision: [web/src/components/conversation]
preparation: ready
---

# Interim replies as stage cards in a turn (Vaiheet, no turn head)

Implement the interim-reply design Jari chose on 2026-10-19 from the round `proto-interim-replies` (`design-system/prototypes/rounds/2026-10-19-valivastaukset/`, direction 3 **Vaiheet**, its `issues/proto-interim-replies/result.md` including "Jari's choice"): each interim assistant reply inside a turn is a reply card where it was written; before each reply a quiet stage summary row (`› 1 ajatus · 2 työkalua · <last command>`) opens only that stage's work; the final answer is the last card. **Change from the prototype:** the turn head row (`Pi · <model> · N ajatusta · N työkalua · 0:44`) is removed; the stage rows replace it. Live/streaming, history, phone, light and dark as in the round.
