---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
preparation: pending
lane: remote-browser-research
lane_seq: 1
---

# Research and architecture sketch: a person's own server-side browser, opened remotely, then used by the agent

## Description

Jari 6.11.2026: henkilöllä voisi olla palvelimella oma virtuaalinen
graafinen työpöytä, jossa on selain (Chrome/Chromium). Henkilö avaa sen
etänäkymänä omaan selaimeensa Habitatin kautta, kirjautuu siinä johonkin
palveluun (esim. palvelu, jolla ei ole APIa tai jonka kirjautuminen vaatii
ihmistä: MFA, captcha) ja sulkee etänäkymän. Sen jälkeen henkilön agentti
käyttää samaa, jo kirjautunutta selainta skriptaamalla tai computer use
-tyyppisesti.

Tämä on arkkitehtuurityö: selvitä vaihtoehdot ja piirrä suositeltu
arkkitehtuuri, joka tuodaan Jarille päätettäväksi (root `AGENTS.md`:
komponenttien valtuudet ja turvamalli päätetään yhdessä).

Selvitä ja perustele:
- **Virtuaalinen näyttö ja etäkäyttö selaimeen**: Xvfb/Xvnc + noVNC,
  KasmVNC, Xpra HTML5, Selkies/WebRTC, Wayland-vaihtoehdot (headless
  sway/weston + wayvnc), Chromen oma headful-tila ilman täyttä työpöytää.
  Viive, kaista, leikepöytä, äänettömyys, mobiili, lisenssit, kypsyys,
  Ubuntu-paketit (amd64 ja arm64).
- **Miten se kulkee Habitatin kautta**: gateway todentaa selaimen ja
  välittää yhteyden henkilön omalle daemonille kuten code-server ja
  shell nyt (lue `internal/gateway`, `internal/daemon`, editorin ja
  shellin välitys). Ei TCP-portteja, joihin toinen paikallinen käyttäjä
  ylettyy: per-käyttäjän Unix-socketit ja tiedosto-oikeudet.
- **Agentin pääsy selaimeen**: Chrome DevTools Protocol (Playwright,
  Puppeteer, `chrome-devtools-mcp`, Playwright MCP), computer use
  -kuvakaappaus+hiiri-malli, tai molemmat. Huom.:
  `--remote-debugging-port` localhostissa on jokaisen paikallisen
  käyttäjän ulottuvilla ja olisi Unix-käyttäjärajan rikkomus; vertaa
  `--remote-debugging-pipe`, Unix-socket-välitys ja muut. Miten Pi tai
  muu agentti saa työkalun natiivisti (laajennus, MCP, CLI-taito).
- **Elinkaari ja resurssit**: käynnistyykö pyydettäessä, jääkö
  päälle etänäkymän sulkemisen jälkeen, mitä tapahtuu daemonin
  uudelleenkäynnistyksessä, muisti- ja kiintiövaikutus (Chrome-profiili
  henkilön kodissa), käyttäjän slice, useampi selain.
- **Turvallisuus**: kirjautuneen profiilin evästeet ovat tunnuksia
  (henkilön kodissa, 0700); agentin toimet henkilön nimissä; mitä
  henkilö näkee siitä, mitä agentti selaimessa tekee (katselu
  jälkikäteen tai livenä), miten hän ottaa ohjauksen takaisin; mitä ei
  saa tehdä (ei jaettua selainta, ei Habitatin välittäjää
  tunnuksille).
- **Olemassa olevat tuotteet** vertailuksi (Browserbase, Anthropic
  computer use -referenssi, Kasm Workspaces, Steel, Neko, Browserless):
  mitä niistä voi käyttää natiivikomponenttina, ei mallina rakentaa.

Tulos: suositeltu arkkitehtuuri (komponentit, kuka omistaa mitäkin
valtuutta, prosessi- ja socket-kaavio), vaihtoehdot hylkäysperusteineen,
riskit ja enintään viisi kysymystä Jarille.

## Acceptance Criteria

- [ ] report.md (suomeksi): vaihtoehdot, suositeltu arkkitehtuuri valtuuksineen, turvamalli, resurssit, kysymykset Jarille; lähteet.

## Result

[report.md](report.md): suositus on henkilön oma `systemd --user` -selainyksikkö
(TigerVNC Xvnc + Chrome `--remote-debugging-pipe` + selainisäntä, joka tarjoaa
CDP:n `0600`-Unix-socketissa). Etänäkymänä toimii mukaan paketoitu noVNC
appin originissa, gatewayn ja daemonin WebSocket-välityksellä kuten shell.
Kokeilu Birchlla (arm64) vahvisti putki- ja Unix-socket-välityksen
Playwrightille ja Puppeteerille sekä AppArmorin userns-vaatimuksen
sandboxille. Viisi kysymystä Jarille, joista tärkein on, mistä Chrome
tulee. Kokeen skriptit ovat hakemistossa [experiment/](experiment/).
