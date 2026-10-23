---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: agent-host
lane_seq: 2
collision: [internal/daemon/pi]
closed: 2026-10-23
---

# Conversation titles are too long

## Description

Jari 2026-10-23: title regeneration works, but the title is too long: "Muistutus: testataan muistutusta tässä ke…" is truncated in the header. Titles should be short, about 2–5 words and well under the header width (≈ 40 characters), in the conversation's language, without prefixes like "Muistutus:". Adjust the title prompt/constraints and enforce a length bound in code (re-ask or trim at a word boundary, never mid-word).

## Acceptance Criteria

- [x] Generated and regenerated titles stay within the bound; test with real Pi against synthetic conversations in Finnish and English.
