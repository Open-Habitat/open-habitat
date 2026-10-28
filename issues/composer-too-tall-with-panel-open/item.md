---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-10-28/composer-too-tall-with-panel-open
lane: composer-height
preparation: ready
closed: 2026-10-28
---

# Composer takes the conversation's space when the bottom panel is open

## Description

Jari 2026-10-28 (Birch, pilot.13): kun alalaatikko (pääte tai muu alapaneeli) on auki, tekstikentän pitäisi olla kapeampi/matalampi. Kun kentässä on paljon tekstiä, itse keskustelulle ei enää jää tilaa. Rajaa kentän kasvu suhteessa käytettävissä olevaan korkeuteen (alapaneeli auki tai kiinni), ja anna kentän vierittyä sisäisesti.

## Acceptance Criteria

- [x] Alapaneelin ollessa auki keskustelulle jää näkyvä osuus myös pitkällä luonnoksella; työpöytä ja puhelin; selaintesti
