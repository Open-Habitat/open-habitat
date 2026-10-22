---
created: 2026-10-22
updated: 2026-10-22
type: task
reporter: jari
status: in-progress
priority: normal
lane: proto-skill
lane_seq: 1
preparation: ready
---

# Prototype: how a skill invocation appears in the conversation

## Description

Jari 2026-10-22: invoking a skill (e.g. /skill:open-habitat-start-page) shows the person's message as the raw expanded skill: '<skill name=… location="/var/tmp/oh-recap-…/SKILL.md"> References are relative to … # A useful first conversation …' with 'Näytä koko viesti' (screenshot /var/tmp/oh-shots/skill-use.png on Alder). It exposes internal paths and the whole skill text. Prototype round (same method as earlier proto-* rounds): how the person's skill invocation and any extra text they typed are shown (e.g. a compact skill chip with name and short description, expandable to the skill's own text), consistent with how native Pi records it; desktop/phone, light/dark, published for review. Jari picks; implementation later.

## Prototype review

Three source-grounded directions and recommendation are ready in [result.md](result.md). Review: https://glasspad.example.test/p/b552pubbvo7ely3wdqsay57zhm/. Awaiting Jari’s choice; preparation is pending and no product implementation is included.

## Decisions

### 2026-10-22T06:11:27Z · @jari

Jari 2026-10-22 on round 1: choose Siru. Fix: the open/close caret renders wrong; the description shows HTML artefacts. Collapsed, show only the skill's description first; the full skill text should open in some other way (not inline dump). Make a riff round on Siru with these.
