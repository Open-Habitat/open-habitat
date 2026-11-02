---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: jari
status: fixed
priority: high
lane: rail-turn-stuck-quiet
lane_seq: 1
collision: [web/src/app/railNow.ts]
preparation: ready
closed: 2026-11-02
---

# A conversation that was once quiet never returns to Sinun vuorosi

## Description

Jari 2.11. 09:29 (screenshot): in the rail, conversations whose agent has
just finished and waits for him (green dot, "nyt" / "10 min": *NDA-viestin
tarkistus*, *Contosoin tapaaminen*) sit in **Hiljaiset** instead of
**Sinun vuorosi**. Jari: once a conversation has been in Hiljaiset, it no
longer moves to Sinun vuorosi when its agent finishes a new turn.

Expected: every turn that ends and leaves the conversation waiting for the
person puts it in Sinun vuorosi until he has seen it, however many times it
has been quiet before; Hiljaiset holds only conversations with nothing new.

Membership is decided in `web/src/app/railNow.ts` (`turn = attention ||
...`, `attention = metadata.attention.get(id) === "new"`); the likely fault
is that attention is not raised again for a conversation already seen, or
is only raised for the open/known conversation. Screenshot of the report:
the conductor's copy is not committed (private conversation names).

## Acceptance Criteria

- [ ] A conversation that was quiet, then gets a new finished turn, appears in Sinun vuorosi (in this tab and in another tab/machine), and returns to Hiljaiset after it is seen.
- [ ] A regression test covers the quiet → new turn → Sinun vuorosi cycle twice.
