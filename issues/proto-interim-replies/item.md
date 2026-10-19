---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: done
priority: normal
lane: prototypes
lane_seq: 1
collision: [design-system/]
preparation: ready
closed: 2026-10-19
---

# Prototype: interim assistant replies inside a turn

Jari on the test server (pilot.231), 2026-10-19, with a Claude Opus 5.5 agent via Pi. Claude in particular writes a short status message to the user in the middle of a turn ("Working tree on puhdas, ei paikallisia committeja — pelkkä pull riittää, pushattavaa ei ole.") and then continues with tools. Today the expanded turn group shows it as a plain text line between the `bash` tool rows and the "Ajattelu" rows; when the group is collapsed it is hidden entirely and only the final "Vastaus valmis" card shows.

Jari: such a message is a reply to him — not the final reply, but a reply — so it should look like an actual answer message in the conversation, and it should also be visible when the turn's tool group is collapsed. He asks for a clear prototype round for handling this kind of interim message: "Tämän tyyppisen viestin käsitteleminen on sellainen, että mä toivoisin tästä semmoista selkeää prototyyppaamista. Tehdään tälle prototyyppauskierros."

Prototype round per `design-system/process.md`: 2–3 directions for showing interim assistant text inside a turn (expanded and collapsed group, several interim messages, interim message right before the final answer, streaming, phone), built on the current conversation components and tokens, with screenshots for Jari's choice. No production change in this issue; the accepted prototype becomes the specification of a later implementation issue.

## Round result (2026-10-19)

Round `design-system/prototypes/rounds/2026-10-19-valivastaukset/` is built and awaiting Jari's choice; `result.md` has the directions, the recommendation (1 · Viesti langassa) and the questions. The chosen direction becomes the specification of a separate implementation issue.
