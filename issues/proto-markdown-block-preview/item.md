---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/proto-markdown-block-preview
lane: markdown-preview-proto
lane_seq: 1
---

# Prototype: open a Markdown code block in the editor's preview

## Description

Jari 6.11.2026: keskustelussa näkyvä Markdown-koodilohko (```markdown)
pitäisi voida avata editorin esikatselutilaan. Esimerkiksi agentin
ehdottama ohjeluonnos tai dokumentti näkyy nyt koodina; henkilö haluaa
nähdä sen renderöitynä editorin Markdown-esikatselussa.

Prototypoi: miten Markdown-lohkon toiminto näkyy (lohkon otsakkeen
painike kopioinnin ja kielimerkinnän vieressä, valikko, lohkon klikkaus),
mihin se avautuu (editorin esikatselu väliaikaisena tiedostona,
keskustelun viereinen paneeli, näkymäkortti), ja miten puhelimessa, jossa
editoria ei ehkä ole. Tarkista, mitä editori (code-server) ja nykyinen
koodilohko (`web/src/components/`, kielimerkintä, kopiointi) jo tukevat.
Prototyyppikierros AGENTS-WORKFLOW.md:n mukaan.

## Acceptance Criteria

- [ ] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
