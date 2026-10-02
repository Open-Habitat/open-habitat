---
created: 2026-10-02
updated: 2026-10-02
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:12
---

# Pi history exposes unsupported thinking blocks as raw encrypted JSON

## Description

Reporter observation (2 Oct 2026): Later in the same Pi conversation, after the unknown thinking-level event card, a second large text block begins "[Sisältöä ei tueta: thinking]" and prints JSON including encrypted_content; screenshot supplied privately. This is distinct from the already-filed thinking_level_change event card. Reproduction: inspect this live Pi conversation after its history loads and compare source session entries to the rendered history; use redacted or synthetic samples in the public repo. Expected: avoid showing the encrypted thinking payload and verbose unsupported-event JSON in the reading view, while preserving truthful accessible indication if content is omitted. Screenshot contains private session data and is not attached.
