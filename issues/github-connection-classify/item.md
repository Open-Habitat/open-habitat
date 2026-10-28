---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/github-connection-classify
lane: github-warning
lane_seq: 2
blocked_by: ['@github-connection-warning']
---

# GitHub connection: daemon tells outage, rejected token and organisation restriction apart

## Description

Osa 2 issuesta proto-github-connection-warning (result.md, Suositus): daemon luokittelee GitHub-yhteyden tilat henkilön omilla tunnuksilla: katkon oma tila ja uudelleenyrityksen eteneminen, 401:n lisätarkistus, organisaation esto ja agentin epäonnistuneen git/gh-komennon laukaisema tarkistus. Ei refresh tokenin tallennusta (ei omaa tunnusvälittäjää).
