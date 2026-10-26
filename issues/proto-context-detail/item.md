---
created: 2026-10-25
updated: 2026-10-26
type: improvement
reporter: jari
status: open
priority: normal
lane: context-impl
lane_seq: 2
blocked_by: ['@proto-context-basic']
preparation: pending
---

# Prototype the detailed context status of an agent and where it lives

## Description

Jari, 2026-10-25: "prototyypataan, miten tässä käyttöliittymässä voisi
näyttää agentin käyttämän kontekstin. Siinä on kaksi tasoa (jotka pitää
prototyypata erikseen): miten näytetään perustila eli se %-luku tai
tokenimäärät, ja miten näytetään tarkempi status ja missä."

This issue is the second level: the detailed context status (what fills the
context: system prompt and instructions, tools, history, attachments, tool
output; compaction history and what it would drop; cost/tokens per turn) and
where it opens from the basic indicator (popover, side panel, settings-like
page). Variants with notes for Jari's verdict, after the basic level's
verdict so it builds on the chosen indicator. Note which facts Pi and Claude
Code expose natively and what the host would have to read.

## Acceptance Criteria

- [ ] Prototype variants with notes, and Jari's verdict recorded.

## Decisions

### 2026-10-26T12:10:19Z · @jari

Jari 2026-10-26: a measured total with estimated parts (Pi chars/4), labelled as an estimate, is enough for now. Claude Code reports its own breakdown when sent '/context' as a message; check whether OpenAI/Codex (or Pi) has an equivalent and prefer such native breakdowns where they exist. Variant verdict pending.
