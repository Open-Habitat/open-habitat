---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: unlaned
collision: [design-system/prototypes/rounds/proto-queued-send]
preparation: ready
---

# Prototype: sending while Pi is not yet running (new conversation and lazy resume)

Two decided behaviours need one shared look before they are implemented: `composer-and-new-conversation` point 3 (the field stays enabled while a new conversation is created; the first message is sent when Pi is ready, visibly queued) and `lazy-resume-on-send` (a stopped conversation opens as readable history with an enabled composer and no "Vain luku" bar; sending starts Pi and delivers the message). In both, the person sends before Pi is running. Jari asked for no "Pi process starting" details.

Prototype what the person sees from pressing Lähetä until Pi answers: where the sent message appears and how it reads as queued rather than delivered, what (if anything) says Pi is starting, whether a second message can be queued behind it and how, how Stop behaves before Pi runs, and what a failed start looks like (message kept, retry). Show both entry points, a new conversation in an empty workspace and a stopped conversation with long history, on desktop and phone. Base it on the current library composer (`lib/composer.*`, the queue it already draws) and the chosen Kentän alla layout.

## Acceptance Criteria
- [ ] Round verified with check.mjs; result.md per the prototype worker rules, with the host facts the view assumes (queued state, start failure) and questions for Jari.

