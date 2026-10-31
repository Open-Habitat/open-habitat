---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: fixed
priority: low
lane: bell
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Notification bell panel header: drop 'voimassa nyt'

## Description

## Description

Jari 30.10. (testikone pilot.518): kellon paneelin otsikon *voimassa nyt* on tarpeeton; otsikoksi riittää *Ilmoitukset*. Teksti on `web/src/components/StatusBell.tsx:217` (`notification-bell-status`).

## Acceptance Criteria

- [x] Paneelin otsikko on pelkkä *Ilmoitukset*; storyt ja specit päivitetty.
