---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-10-28/text-selection-lost-in-agent-reply
lane: conversation-select
preparation: ready
closed: 2026-10-28
---

# Selecting text in an agent reply flickers and is often lost

## Description

Jari 2026-10-28 (Birch, pilot.13): kun maalaan agentin viestistä tekstiä, valinta välähtää ja usein poistuu; toisinaan se jää. Todennäköisesti viestin uudelleenrenderöinti (live-päivitys, aikaleiman tikitys, hover-tila tai Markdown-renderöinti) vaihtaa DOM-solmut valinnan alta. Selvitä, mikä renderöi valmiin viestin uudelleen valinnan aikana, ja korjaa niin, että valinta säilyy sekä valmiissa että live-vastauksessa.

## Acceptance Criteria

- [x] Hiirellä ja näppäimistöllä tehty valinta säilyy agentin viestissä; selaintesti valitsee tekstiä live-päivitysten aikana
