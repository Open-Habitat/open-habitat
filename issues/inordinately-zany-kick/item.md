---
created: 2026-09-30
updated: 2026-09-30
type: task
status: done
priority: normal
provenance: other
provenance_detail: Synthetic UX audit by taskfleet research worker
source_ref: taskfleet:01m3qwskng8cfr1f2fknghrqrz/ux-audit-round-7
originating_run: 01m3qwskng8cfr1f2fknghrqrz
originating_run_kind: research
closed: 2026-09-30
---

# Browser UX audit round 7: first use and return-to-work coherence

## Description

Seitsemäs koko selaimen UX-katselmus synteettisessä labissa nykyisestä main-johdannaisesta revisiosta bcf3dbb. Raportti ja pienet synteettiset kuvat: audit.md. Havaittu viimeistelytarve: tulevan tuntemattoman Pi-kysymyksen kysymysteksti hautautuu JSON-esitykseen, vaikka sisältö on turvallisesti luettavissa. Ei uutta varmennettua toiminnallista vikaa; ensikäyttö ja paluupolku tarkistettu. Ei aikataulutusta tässä intake-vaiheessa.

## Acceptance Criteria

- [x] Tuntemattoman kysymyksen ymmärrettävä teksti näkyy ennen avattavaa raakasisältöä turvallisesti; regressiotesti kattaa HTML:n ja vioittuneen sisällön.
- [x] Aamun synteettinen kuvakatselmus päivitetty.
