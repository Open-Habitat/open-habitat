---
created: 2026-10-26
updated: 2026-10-27
type: bug
status: testing
priority: normal
lane: conversation-live
collision: [web/src/app/BrowserConversation.tsx]
preparation: ready
---

# Tapahtumia jäi väliin -banneri roikkuu pitkän vuoron ajan

## Description

Jari, Birch (`pilot.11`), 2026-10-26 noin klo 12.55. Selainkeskustelussa
`pi:25e47b02-5e5f-41d7-b030-89923302588c` (työtila
`ws_9aVGVKUBudoprTcn3hHCt04R`, käyttäjä `maintainer`) näkyi agentin
pitkän vuoron aikana banneri "Tapahtumia jäi väliin · Live-tapahtumien
häntä ei ole täydellinen. Tarkista natiivi historia." Banneri pysyi
näkyvissä, kunnes vuoro päättyi ja lopullinen vastaus tuli. Samalla
välivastaukset ja työkalukutsut näkyivät normaalisti
(alkuperäinen bannerin kuvakaappaus `attachments/banner.png` kuuluu projektin
historiaan eikä ole tässä repositoriossa).

Vuorossa oli useita lyhyitä välivastauksia, ja agentti teki git pushin
ja issuectl-kutsuja. Jari kirjoitti kaksi viestiä kesken vuoron
("Ja etkö tiedä omaa palvelinosoitettasi?" ja "Se redirectaa tänne: …").
Ohjausviestit kesken vuoron ovat siis ehdokas laukaisijaksi.
Toinen ehdokas on, että Jari avasi samaan aikaan toisessa välilehdessä
muutaman kerran `/auth/github/start`-kirjautumisen. Jokainen kirjautuminen
uusii selainistunnon, ja se voi katkaista tai vaihtaa live-tapahtumavirran
kesken vuoron.

Sama oire korjattiin `conversation-live-glitches`-issuessa (suljettu
17.10., mukana `pilot.11`:ssä), ja `composer-and-new-conversation`
käsitteli sen uudessa keskustelussa. Oire on siis palannut, tai sille
on toinen syy. Lue keskustelun sisällön sijaan metatiedot,
tapahtumien järjestysnumerot ja gatewayn/daemonin `http_request`-tietueet.

## Acceptance Criteria

- [ ] Syy on näytetty todisteilla (live-lokit tai labratoisto); jos syytä ei voi kohdistaa, se sanotaan suoraan
- [ ] Banneria ei näytetä, kun natiivihistoriassa ei oikeasti ole aukkoa, tai se poistuu heti aukon korjaannuttua; selaintesti kattaa laukaisijan

