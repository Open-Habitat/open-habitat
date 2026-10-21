---
created: 2026-10-21
updated: 2026-10-21
type: task
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Prototype: own-computer folder notice and permission button inside the UI

## Description

Jari 2026-10-21 on the test server (Brave): the folder-unavailable notice ('Oman koneen kansio ei ole käytettävissä tämän selaimen nykyisillä asetuksilla… brave://flags/#file-system-access-api …') is very intrusive: it cannot be closed and sits outside the interface. The 'Salli oman koneen kansio' button is likewise outside the interface. Make a prototype round (2–3 directions, production context, desktop/phone, light/dark, published for review) for where folder access lives in the UI (e.g. attachments menu / settings / dismissible inline), how unavailability and the Brave opt-in are explained without a permanent banner, and how the permission request is offered. Jari picks; implementation is a later issue.

## Decisions

### 2026-10-21T16:32:42Z · @jari

Jari 2026-10-21: choose Liitteet (attachments menu → own-computer folder, help and permission in an anchored dismissible panel). The folder should also appear in Integraatiot (settings integrations view). Implementation: implement-folder-attachments.
