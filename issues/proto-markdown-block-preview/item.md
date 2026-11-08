---
created: 2026-11-06
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-markdown-block-preview
lane: markdown-preview-proto
lane_seq: 1
closed: 2026-11-08
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

## Decision (Jari 2026-11-06, kierros 1)

Toiminto on **paikallaan**: lohkon oikeassa reunassa olevien painikkeiden
joukossa (kopioinnin ja kielimerkinnän rinnalla). Kierros 2 riffaa sitä.

## Acceptance Criteria

- [x] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
- [ ] kierros 2: lohkon oman painikkeen kolme riffiä (paikallaan, editoriin, valikko), näkymätarjous ja kysymykset Jarille

## Decision (Jari 2026-11-08, kierros 2)

**1 Paikallaan**: silmä vaihtaa lohkon renderöidyksi samaan kohtaan ja
takaisin. Kysymyksiin 2 ja 3 kierroksen suosituksen mukaan (kapellimestari).
Toteutus: `markdown-block-preview`.
