---
created: 2026-10-25
updated: 2026-10-25
type: improvement
reporter: jari
status: open
priority: normal
lane: proto-context
lane_seq: 1
preparation: ready
---

# Prototype the basic indicator of an agent's context use

## Description

Jari, 2026-10-25: "prototyypataan, miten tässä käyttöliittymässä voisi
näyttää agentin käyttämän kontekstin. Siinä on kaksi tasoa (jotka pitää
prototyypata erikseen): miten näytetään perustila eli se %-luku tai
tokenimäärät, ja miten näytetään tarkempi status ja missä."

This issue is the first level: the always-visible basic state of how much
of the model's context window the conversation uses (percentage, tokens, or
something else), where it sits (top bar next to model and thinking level,
composer, status line), how it behaves near the limit and after compaction,
and on phone. Variants with notes for Jari's verdict. Note which facts Pi
and Claude Code expose natively for this (both report token usage per turn)
and whether the host already reads them.

## Acceptance Criteria

- [ ] Prototype variants with notes, and Jari's verdict recorded.

