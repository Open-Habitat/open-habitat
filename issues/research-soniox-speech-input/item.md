---
created: 2026-10-26
updated: 2026-10-26
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/research-soniox-speech-input
lane: speech-input
lane_seq: 1
preparation: pending
---

# Research: streaming speech-to-text input with Soniox

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Viestikenttään puhesyöte. Jari: 'Tämä voitaisiin toteuttaa streaming speech-to-textinä käyttäen soniox.comia.'

Selvitä Sonioxin reaaliaikainen rajapinta (WebSocket-striimaus, suomen tuki ja laatu, välitulokset, hinnoittelu, tietosuoja ja datan säilytys) ja ennen kaikkea avaimen hallinta: kenen Soniox-avain on käytössä (ylläpitäjän vai käyttäjän oma, kuten AI-avaimet), voiko selain striimata suoraan Sonioxille lyhytikäisellä väliaikaisella avaimella, jonka daemon hakee, vai kulkeeko ääni isännän kautta. Älä paljasta pysyvää avainta selaimelle. Tunnista kohdat, jotka siirtävät valtuutta gatewayn, daemonin ja provisionin välillä; ne ovat Jarin arkkitehtuuripäätöksiä. Tulos: raportti ja suositus, proto-speech-input-kierroksen lähtökohta.

## Result

[result.md](result.md): Sonioxin reaaliaikarajapinta, suomi, välitulokset, hinnoittelu, tietosuoja ja avaimen hallinta. Suositus: henkilön oma avain kotihakemistossa, daemonin luoma kertakäyttöinen väliaikainen avain ja suora striimi selaimesta. Jarin päätökset P1–P4 (erityisesti P1: väliaikainen avain sopimuksen yli selaimelle).
