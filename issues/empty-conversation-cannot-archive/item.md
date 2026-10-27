---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: open
priority: high
provenance: chat
source_ref: chat:2026-10-27/empty-conversation-cannot-archive
lane: conversation-archive
preparation: ready
---

# A new conversation without native history cannot be closed or archived

## Description

Jari 2026-10-27 klo 10.54 (Birch, pilot.12): keskustelua pi:b3a8fb8f-5784-4dc7-8d4a-629eddd7cd62 (northwind-monorepo, ws_h538weYncb09vJBRlM1NO12Y, otsikko 'Uusi keskustelu') ei voi sulkea eikä arkistoida. Keskustelun sulkemisrasti on harmaana, ja työtilan etusivun kortin arkistointipainike antaa virheen 'Arkistointia ei tehty. Keskustelu palautettiin listaan.' Kortissa lukee 'Tila ei tiedossa · Katsausta ei voitu lukea' (kuva attachments/archive-error.png).

Konduktorin havainto: käyttäjän ~/.pi/agent/sessions/--home-maintainer-src-northwind-monorepo--/ -hakemistossa ei ole tämän tunnisteen istuntotiedostoa. Keskustelu on siis luotu, mutta Pi ei ole kirjoittanut natiivihistoriaa (todennäköisesti viestiä ei lähetetty tai käynnistys epäonnistui). Arkistointi ja sulkeminen olettavat natiivin istunnon. Tällaisen keskustelun pitää olla suljettavissa ja poistettavissa listasta (tai sitä ei pidä jäädä listaan lainkaan), ja kortin tilan pitää kertoa rehellisesti, ettei keskustelussa ole vielä mitään.

## Acceptance Criteria

- [ ] Syy näytetty todisteilla (metatiedot, ei sisältöä); keskustelu ilman natiivia istuntoa voidaan sulkea ja arkistoida tai se ei jää listaan; testi rajalla
