---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: agent-host
lane_seq: 3
collision: [internal/daemon/pi]
---

# Titles cut mid-phrase and title model unavailable

## Description

Jari 2026-10-23 08:27 on e7872708, after `conversation-title-too-long`:
- Regenerating gave "Repositorion sisällön ja" — a hard cut at five words / 32 characters produces nonsense. Never truncate a title mechanically; ask the model for a short, complete title (2–5 words) and if the answer is too long, ask once more with the constraint; only then fall back to a sensible complete phrase.
- Another attempt failed with "Otsikkoa ei voitu luoda. Otsikointimalli ei vastannut." (`conversation_title outcome=failed operation=history reason=model_unavailable` at 4.7 s). Find why the title model was unavailable (timeout too short for a cold Pi, wrong model selection, provider error) and fix it.

## Acceptance Criteria

- [ ] Titles are complete, meaningful phrases within the bound, tested with real Pi on Finnish and English conversations including a long first message; no "model_unavailable" on a cold start.
