---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: open
priority: high
provenance: chat
source_ref: chat:2026-10-27/composer-dead-after-long-pause
lane: composer
preparation: ready
---

# Composer stops accepting text after returning to a conversation after a long pause; only a page reload helps

## Description

Jari 2026-10-27 (Birch, pilot.12): kun palaan keskusteluun pitkän tauon jälkeen (esim. tunti) ja olen kirjoittanut siihen jotain, viestikenttä ei enää ota tekstiä. Keskustelun vaihtaminen toiseen ja takaisin ei auta; vain sivun uudelleenlataus auttaa.

Ehdokkaat selvitettäväksi todisteilla: selaimen tila jää 'stale'/'reconnecting'- tai vanhentuneen istunnon tilaan, jossa kenttä on disabloitu tai read-only (vrt. composer-focus-stolen-by-interim ja stale-banner-while-live-works, jotka korjasivat vaiheen authenticated→stale vaihtelua; ne eivät ole Birchlla); välilehden taustalle jääminen (Page Lifecycle freeze/discard, SSE-yhteyden katkeaminen) ilman palautusta; luonnoksen palautus, joka lukitsee kentän; joutoajalla pysähtynyt Pi ja uusi herätys (wake-stopped-agent: kirjoittaminen herättää) — tarkista, ettei herätyksen odotus lukitse kenttää. Toista labrassa simuloimalla pitkä tauko (kello, visibilitychange, verkkokatko, istunnon uusiminen) ja tarkista testikoneella (pilot.446), onko vika jo poissa.

## Acceptance Criteria

- [x] Syy nimetty todisteilla; kenttä ottaa tekstiä pitkän tauon jälkeen ilman uudelleenlatausta; selaintesti simuloi tauon
