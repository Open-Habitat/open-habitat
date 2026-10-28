---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: conductor
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/proto-worker-row-work-facts
lane: proto-worker-row-work-facts
lane_seq: 1
---

# Prototype: work facts on worker and worktree rows (changes, ahead/behind, PR, checks)

## Description

Konduktorin oma prototyyppikierros 2026-10-28 (AGENTS-WORKFLOW: konduktori voi tilata prototyyppikierroksen omalla harkinnallaan) research-workmux-sidebar-raportin idean 5 pohjalta: worker- ja worktree-rivi kertoo ennen avaamista, onko worker tuottanut jotain (muutetut tiedostot, +/- rivit, ahead/behind, PR ja sen tarkistukset). Host-faktat: gitSummary on olemassa worktree-paikoille, Taskfleetin worktreet on jätetty pois (snapshot.schema.json), PR ja checks vaatisivat henkilön oman gh:n. Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti Workerit-paneeli, sivupalkki ja worker-näkymä, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto). Jari valitsee; toteutus on myöhempi issue.
