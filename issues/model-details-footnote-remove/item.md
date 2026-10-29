---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: done
priority: normal
lane: ui-polish
lane_seq: 14
preparation: ready
closed: 2026-10-29
---

# Remove the conversation model details footnote

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Keskustelun mallitietojen alahuomautus on tarpeeton (Jari 28.10., pilot.471): *Tämän keskustelun malli ja ajattelutaso. Vaihtoehdot ovat vertailua varten, eivät valintoja.* poistetaan. Enintään vastaava selitys voisi näkyä silloin, kun ihminen yrittää vaihtaa mallia tai ajattelutasoa. Koodi: `ConversationModelDetails` (`web/src/components/ConversationModelDetails.tsx`).
