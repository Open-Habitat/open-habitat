---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: proto-details
lane_seq: 2
collision: [design-system/prototypes/rounds/proto-composer-strip]
preparation: ready
---

# Prototype: bottom-anchored thread fill; process and spinoff strip

Jari, 2026-10-16 evening. Two prototyping topics in one round, or two rounds, whichever reads better:
1. **Fill direction of a new conversation.** Today the thread starts at the top of the page. "Tuntuisi luontevammalta, että se lähtisi liikkeelle alalaidasta ja kasvaisi ylälaitaan kohden." (In short: it would feel more natural if the thread started from the bottom and grew upwards.) Prototype how a new conversation fills after the first message, chat-style anchored to the bottom versus anchored at the top, so he can see how the text flows after he writes, including a long reply, tool work, and the recap.
2. **Processes and spinoffs above the composer.** The process row has a tidy bar above the composer, but spinoffs do not. Processes and spinoffs should appear on an equal footing and visually alike, in one shared strip or two matching bars. Base it on `rounds/2026-10-16-prosessit` direction 3, `2026-10-16-prosessilohkot` direction 1 and `2026-10-16-spinoffit` direction 1, with Jari's Decisions in those issues. A `taskfleet run wait` is shown as its spinoff, never as a process.

## Acceptance Criteria
- [ ] Round(s) verified with check.mjs; result.md per the prototype worker rules.
