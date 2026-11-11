---
created: 2026-11-11
updated: 2026-11-11
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-11/rename-error
lane: unlaned
preparation: ready
closed: 2026-11-11
closed_by: claude
---

# Renaming a conversation shows an error

## Description

Jari 11.11.2026 klo ~09.4x Birchlla (Habitat, tili maintainer): keskustelun
uudelleennimeämisessä "tuli virhe" samassa yhteydessä, kun hän lisäsi
`kunnollavauhtiin-monorepo`-työtilalle kuvaketta. Virheilmoituksen tekstiä ei ole.

Daemonin journaalissa ei ole epäonnistunutta pyyntöä 09:30–09:45: `POST
/api/v1/conversations/{id}/{id}` 09:38:02 ja 09:38:14 palauttivat 200 (0 ms).
Virhe on siis joko HTTP 200 -vastauksen sisällä (operaation tulos), selaimen
puolella (validointi, tilakonflikti, optimistinen päivitys) tai gatewayssä.
Mahdollinen yhteys: keskustelu juuri luodussa / uudelleennimetyssä työtilassa,
tai nimeäminen kesken käynnissä olevan vuoron.

Selvitettävä: toistuuko, mikä virheteksti selaimessa näkyy, ja korjaus.

## Resolution

### 2026-11-11T08:18:00Z · @claude

Juuri aloitetun keskustelun nimeäminen ei enää vaadi snapshotin agenttia; ks. result.md.
