---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: done
priority: normal
lane: ui-polish
lane_seq: 12
preparation: ready
closed: 2026-10-29
---

# Archive notice stays 20 s; too long

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Arkistoinnin kuittaus näkyy liian kauan (Jari 29.10., pilot.511, tuotepalaute): koskematon kuittaus katoaa vasta 20 sekunnin jälkeen, mikä on Jarin mielestä liian pitkä aika (`NOTICE_LIFETIME_MS`, `web/src/components/ArchiveNotice.tsx`). Muuten kuittaus toimi kuten pitääkin: hiljainen rivi työtilasivun yläreunassa, keskustelussa yläpalkin alla kenttää ja vastausta peittämättä, Esc kentästä ei sulje sitä, ja Esc kuittauksessa sulkee sen ja palauttaa fokuksen kenttään (`archive-notice-header-row`).
