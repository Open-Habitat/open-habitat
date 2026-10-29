---
created: 2026-10-22
updated: 2026-10-29
type: task
reporter: jari
status: done
priority: normal
lane: proto-start
lane_seq: 1
related: ['@start-page-skill']
preparation: pending
closed: 2026-10-29
---

# Prototype: a shorter repository start page

## Description

Jari 2026-10-22: the generated start page (screenshot /var/tmp/oh-shots/start-page.png on Alder) is far too long; the goal cards show full prompts in a narrow, oddly indented column. Should the prompts be hidden, and how should the page appear? Prototype round first (same method as earlier proto-* rounds, production context, desktop/phone, light/dark, synthetic data, published for review): compact intro, goal cards with title and short 'when', prompt revealed or inserted on demand, a reasonable maximum length. Afterwards the start-page skill and format may be updated to match (separate issue after Jari picks).

## Decisions

### 2026-10-22T06:11:27Z · @jari

Jari 2026-10-22 on round 1: wants the goal titles (Tutustu repoon, Korjaa havaittu ongelma, …) clearly visible, each navigating to a separate guide/instruction page. Research how e.g. Legora presents such guided paths/workflows to users (and comparable products), then make a new round.

### 2026-10-22T12:20:56Z · @jari

Jari 2026-10-22 on round 2: Opas. The landing page and the guide page's basic structure are good. Aloita should be visible earlier: conductor's call, put it at the top of the guide page next to the title (keep the one at the end); the landing page keeps goal titles as navigation so the guide is not bypassed. After Aloita inserts the text, focus moves to the end of the composer and the inserted text ends with two newlines so the person's own text starts a new paragraph.
