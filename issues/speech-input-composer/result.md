# Sanelu viestikenttään: toteutus

Toteutettu 2026-10-28 proto-speech-input-kierroksen (Katto, 10 min) ja
research-soniox-speech-input-päätöksen (D + P1) mukaan.

## Mitä tehtiin

- **Henkilön avain** on `~/.config/soniox/key.json` (0600: avain, alue
  `eu`/`us`, lähde `own`/`site`). Daemon on ainoa tuotteen kirjoittaja
  (`internal/daemon/speech_linux.go`). *Asetukset › Sanelu* tallentaa,
  vaihtaa ja poistaa oman avaimen; vastaus kertoo vain läsnäolon, alueen,
  lähteen ja neljä viimeistä merkkiä.
- **Väliaikainen avain**: `POST /api/v1/speech/session` saa daemonin
  luomaan henkilön avaimella `single_use`-avaimen (60 s,
  `transcribe_websocket`, `max_session_duration_seconds` 600) ja
  palauttaa sen, vanhenemisajan ja alueen WebSocket-osoitteen. Sopimuksen
  kiinteät virhekoodit: `speech_key_missing`, `speech_key_rejected`,
  `speech_limit_reached`, `speech_unavailable`. P1-poikkeus on kirjattu
  `internal/AGENTS.md`:n tokensääntöön.
- **Ylläpitäjän avain** (*Palvelimen ylläpito › Saneluavain*) on gatewayn
  oma 0600-tiedosto `site-soniox-key.json` sivuston AI-avaimen vieressä.
  Kopio annetaan vain henkilön omalle daemonille (brokerin `authorize`-reitti,
  `postDaemon`), joka kirjoittaa sen vain, jos avainta ei ole tai se on
  aiempi sivuston kopio. Oma avain ei koskaan korvaudu.
- **Viestikenttä**: mikrofoni Lähetä-painikkeen vieressä, nauhoitusnauha
  (piste, taso, kesto, tila, Valmis), vahvistettu teksti ja himmeä
  välitulos, kappale yli 4 s tauon jälkeen, keepalive 20 s hiljaisuuden
  jälkeen, Esc ja Valmis lopettavat, Lähetä lopettaa ja lähettää, yksi
  uudelleenyhdistys uudella avaimella (katkon ääni puskuroidaan),
  virhe- ja ei avainta -ilmoitukset kentän alla, katon ilmoitus kentän
  yllä minuuttia ennen ja sanelun päättyminen 9:58 kohdalla.
- **Testit**: daemonin ja gatewayn Go-testit synteettisellä Sonioxilla,
  selaimen moottorin yksikkötestit, Composerin komponenttitesti ja
  `web/tests/speech-input.spec.ts` selainhostin synteettistä Sonioxia
  vastaan (`test/browser-host/soniox.go`). Oikeaa avainta tai verkkoa ei
  käytetty.

## Decisions for later review

- **Yhteinen avain annetaan kaikille jo liittyneille heti, kun ylläpitäjä
  tallentaa sen**, ja uusille ensimmäisellä kirjautumisella. Vaihtoehto:
  AI-avaimen tapaan henkilö kerrallaan annettava kopio ja sormenjälkirekisteri.
  Peruste: henkilön oma tiedosto kertoo itse, onko se sivuston kopio
  (`source`), joten erillistä kopiorekisteriä ei tarvita, ja pilottien
  (Birch, Northwind, Contoso) kaikki käyttäjät ovat jo liittyneet. Ylläpitäjä
  näkee vain vastausten määrät, ei kenellä on oma avain. Saman avaimen
  tallentaminen uudelleen tavoittaa ne, jotka jäivät ensimmäisellä kerralla
  saamatta.
- **Ylläpitäjän avaimella ei ole juuren ohjauskomentoa** (`admin
  ai-key`-vastinetta); se asetetaan vain selaimesta. Vaihtoehto: CLI-komento
  ohjaussoketin kautta. Peruste: pienin toteutus; komento voidaan lisätä,
  jos asennus tarvitsee sitä.
- **Alueet ovat EU ja USA.** Sonioxilla on myös JP ja IN, joiden
  osoitteita ei tarkistettu.
- **Daemonin oma raja on 10 väliaikaista avainta minuutissa** henkilöä
  kohden (`speech_limit_reached`). Vaihtoehto: "yksi avoin sanelu per
  sessio". Peruste: daemon ei näe selainsessioita, ja kertakäyttöinen avain
  ei maksa mitään ennen kuin striimi avataan; raja estää silti
  silmukoivan selaimen.
- **Ääni lähetetään raakana PCM:nä** (`pcm_s16le`, selaimen näytetaajuus,
  AudioWorklet) eikä `@soniox/client`-SDK:lla tai MediaRecorderilla.
  Peruste: iOS Safarin `audio/mp4` ei ole Sonioxin auto-listalla, PCM toimii
  kaikissa selaimissa ilman riippuvuutta, ja keepalive, uudelleenyhdistys
  ja puskurointi pysyvät omassa hallinnassa.
- **Malli `stt-rt-v5` ja kielivihjeet `fi`, `en`** researchin mukaan;
  `client_reference_id` jätetään pois (P4).
- **Selain lopettaa 9:58 kohdalla** (kaksi sekuntia ennen Sonioxin
  katkaisua), jotta viimeiset sanat ehtivät vahvistua. Ilmoitus tulee
  9:00 kohdalla ja muuttuu punertavaksi viimeisillä 20 sekunnilla.
- **Pidä pohjassa** yli 0,5 s lopettaa sanelun painikkeen päästäessä,
  kuten prototyypissä.

## Vielä oikealla avaimella todettavaa

Suomen laatu ja iOS Safarin mikrofoni (research-suositus) sekä se, että
`stt-rt-v5` ja tyhjä tekstikehys toimivat oikeassa palvelussa. Ne ovat
KOKEILTAVAA.md:ssä.
