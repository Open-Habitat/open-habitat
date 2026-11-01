# text/ownMachines.tsx

Generated from web/src/text/ownMachines.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Omat koneet and its five-step dialog
// (components/OwnMachines.tsx, app/OwnMachines.tsx, app/ownMachines.ts).
// Names, commands and paths come in as arguments and stay as they are.
const fi = {
  steps: ["Tailscale", "Kone", "Etäkirjautuminen", "Avainrivi", "Vahvistus"],
  forever: "Toistaiseksi",
  days: (n: number) => `${n} pv`,
  pill: {
    active: "Yhdistetty",
    asleep: "Ei vastaa",
    gone: "Ei Tailscalessa",
    expired: "Vanhentunut",
    revoked: "Kone hylkää avaimen",
    changed: "Tunniste muuttui",
  },
  copied: "Kopioitu",
  copyFailed: "Ei onnistunut",
  copy: "Kopioi",
  truthEverything: (
    user: string,
    machine: string | undefined,
    until: string,
    mac: boolean,
  ): ReactNode => (
    <>
      <b>Agentti saa koneella kaiken, mitä käyttäjäsi {user} saa</b>, eikä se
      kysy lupaa jokaiseen komentoon. Pääsy koskee vain{" "}
      {machine ? `konetta ${machine}` : "valitsemaasi konetta"} ja{" "}
      {until ? `päättyy ${until}` : "on voimassa, kunnes perut sen"}.
      {mac
        ? " Täysi levyn käyttöoikeus pysyy pois, joten macOS suojaa yhä Työpöytää, Dokumentteja ja Mailia."
        : ""}
    </>
  ),
  truthRoot: (): ReactNode => (
    <>
      <b>Palvelimen ylläpitäjä pääsee samaa reittiä koneellesi.</b> Avain on
      tilisi kotihakemistossa, ja palvelimen ylläpitäjä (root) voi lukea sen.
      Habitat ei voi estää tätä.
    </>
  ),
  truthCut: (node: string, until: string): ReactNode => (
    <>
      <b>Varma katkaisu tehdään koneellasi:</b> poista rivi, sammuta
      etäkirjautuminen tai poista {node} Tailscale-verkostasi.
      {until ? ` Rivi lakkaa myös itsestään toimimasta ${until}.` : ""} Poisto
      Habitatista ei yksin riitä, koska agentti toimii samana käyttäjänä ja on
      voinut kopioida avaimen.
    </>
  ),
  removeAsUser: "PowerShellissä, jos käyttäjäsi on tavallinen käyttäjä:",
  removeAsAdmin:
    "Jos käyttäjäsi on järjestelmänvalvoja, PowerShellissä, joka on avattu järjestelmänvalvojana:",
  tsPill: {
    unavailable: "Ei saatavilla",
    off: "Ei yhdistetty",
    stopped: "Pysähtynyt",
    login: "Odottaa kirjautumista",
    approval: "Odottaa hyväksyntää",
    starting: "Käynnistyy",
    on: "Yhdistetty",
  },
  nodeIn: (name: string, tailnet: string) => `${name} verkossa ${tailnet}`,
  tsDesc: "Habitatin yhteys omaan verkkoosi",
  tsUnavailable:
    "Tämä palvelin ei vielä tarjoa Tailscalea. Palvelimen ylläpitäjä ottaa sen käyttöön; sinun ei tarvitse asentaa mitään.",
  tsStopped:
    "Habitatin Tailscale-laite on tililläsi, mutta se ei ole käynnissä.",
  start: "Käynnistä",
  tsPending: "Kirjautuminen Tailscaleen on kesken.",
  continue: "Jatka",
  device: "Laite",
  network: "Verkko",
  incoming: "Saapuvat yhteydet",
  shieldsUp: "Estetty: verkkosi laitteet eivät pääse tähän palvelimeen",
  shieldsDown:
    "Sallittu! Joku on muuttanut asetusta Habitatin ohi. Irrota Habitat verkostasi ja yhdistä uudelleen.",
  disconnectQuestion: (node: string): ReactNode => (
    <>
      <b>Irrotetaanko Habitat verkostasi?</b> Habitat pysäyttää laitteensa ja
      poistaa sen avaimen tältä tililtä sekä kaikki koneesi täältä. Laite {node}{" "}
      jää Tailscalen laitelistaan, kunnes poistat sen sieltä. Koneidesi rivit
      jäävät koneille, kunnes poistat ne tai ne vanhenevat.
    </>
  ),
  cancel: "Peru",
  disconnect: "Irrota",
  disconnectHabitat: "Irrota Habitat verkostasi",
  habitatDevice: "Habitatin laite",
  connectionOpen: "Yhteys auki",
  expired: (date: string): ReactNode => (
    <>
      <b>Pääsy päättyi {date}.</b> Kone ei enää hyväksy avainta. Uusi pääsy
      antaa uuden rivin, joka korvaa vanhan.
    </>
  ),
  revoked: (until: string): ReactNode => (
    <>
      <b>Kone hylkäsi avaimen</b>, vaikka pääsy olisi ollut voimassa
      {until ? ` ${until} asti` : ""}. Rivi on luultavasti poistettu koneelta
      tai etäkirjautuminen on pois päältä. Jos teit sen itse, poista kone myös
      täältä.
    </>
  ),
  changed: (): ReactNode => (
    <>
      <b>Koneen tunniste on eri kuin tallennettu.</b> Habitat ei ota yhteyttä
      siihen. Jos asensit koneen uudelleen, poista se täältä ja lisää uudelleen.
      Muuten osoitteessa vastaa jokin muu kuin koneesi.
    </>
  ),
  asleep: (name: string): ReactNode => (
    <>
      <b>{name} ei vastaa.</b> Kone on luultavasti unessa tai Tailscale on
      suljettu. Agentti yrittää uudelleen, kun pyydät.
    </>
  ),
  gone: (name: string): ReactNode => (
    <>
      <b>{name} ei ole enää Tailscale-verkossasi.</b> Agentti ei pääse siihen,
      ennen kuin se on taas verkossa.
    </>
  ),
  accessEnds: "Pääsy päättyy",
  access: "Pääsy",
  untilRevoked: "voimassa, kunnes perut",
  agentOnMachine: "Agentti koneella",
  asUser: (user: string) => `käyttäjänä ${user}, kaikki mitä ${user} saa`,
  hostKey: "Koneen tunniste",
  missingValue: "puuttuu",
  habitatKey: "Habitatin avain",
  inTailscale: "Tailscalessa",
  present: "paikalla",
  lastSeen: (ago: string) => `viimeksi paikalla ${ago}`,
  offline: "ei verkossa",
  forAgent: "Agentille",
  whatItGives: "Mitä yhteys antaa",
  howToCut: "Näin katkaiset pääsyn koneelta",
  removeLine: "Poista Habitatin rivi koneen päätteessä:",
  orStop: (os: string, node: string) =>
    `Tai ${
      os === "mac"
        ? "sammuta Etäkirjautuminen (Järjestelmäasetukset › Yleiset › Jakaminen)"
        : os === "windows"
          ? "pysäytä OpenSSH-palvelin (järjestelmänvalvojan PowerShellissä: Stop-Service sshd; Set-Service sshd -StartupType Disabled)"
          : "pysäytä SSH-palvelin (sudo systemctl disable --now ssh)"
    }, tai poista laite ${node} Tailscalen hallintasivulta.`,
  removeQuestion: (name: string, until: string): ReactNode => (
    <>
      <b>Poistetaanko {name}?</b> Habitat poistaa koneen yhteysasetuksen ja
      tunnisteen tililtäsi. Koneesi hyväksyy riviä yhä
      {until ? ` ${until} asti` : ", kunnes poistat sen"}, jos joku on ehtinyt
      kopioida avaimen, joten poista rivi myös koneelta:
    </>
  ),
  removeMachine: "Poista kone",
  check: "Tarkista yhteys",
  reconnect: "Yhdistä uudelleen",
  renew: "Uusi pääsy",
  remove: "Poista",
  intro:
    "Agentti voi käyttää omaa tietokonettasi SSH:lla oman Tailscale-verkkosi kautta, esimerkiksi tarkistaakseen asetuksia tai avatakseen tiedoston. Koneellesi ei asenneta mitään Habitatin omaa.",
  machines: "Koneet",
  removed: (name: string): ReactNode => (
    <>
      <b>{name} poistettu Habitatista.</b> Poista vielä rivi koneelta, niin
      pääsy loppuu varmasti:
    </>
  ),
  includeFailed: (file: ReactNode): ReactNode => (
    <>
      Tiedostoa {file} ei voitu muuttaa (se on luultavasti linkki). Lisää sen
      alkuun tämä rivi, jotta agentti löytää koneet nimellä:
    </>
  ),
  none: "Ei yhdistettyjä koneita.",
  add: "Lisää kone",
  addAnother: "Lisää toinen kone",
  addTime: "Noin viisi minuuttia. Tarvitset koneen viereesi.",
  peerLegend: "Kone Tailscale-verkossasi",
  peerSaved: "lisätty jo",
  peerNoSsh: "ei SSH-palvelinta",
  peersNote:
    "Lista on Tailscale-verkostasi. Jos konettasi ei näy, se ei ole vielä kirjautunut samaan verkkoon.",
  checkOk: (): ReactNode => (
    <>
      <b>Kone hyväksyi avaimen.</b> Vielä yksi tarkistus: koneen tunniste.
    </>
  ),
  checkRejected: (user: string, os: string, dated: boolean): ReactNode => (
    <>
      <b>Kone ei hyväksy avainta vielä.</b> Kone vastaa, mutta hylkää avaimen.
      Aja komento koneella käyttäjänä {user} ja tarkista uudelleen.
      {os === "mac"
        ? ` Jos ajoit sen, tarkista että etäkirjautuminen sallii käyttäjän ${user}.`
        : os === "windows"
          ? ` Jos käyttäjäsi on järjestelmänvalvoja, aja järjestelmänvalvojan komento.${dated ? " Jos ajoit sen, tarkista OpenSSH:n versio (ssh -V): rivi vaatii version 8.2 tai uudemman." : ""}`
          : ""}
    </>
  ),
  checkOffline: (): ReactNode => (
    <>
      <b>Tailscale ei näe konetta.</b> Kone on luultavasti unessa tai sen
      Tailscale on suljettu.
    </>
  ),
  checkNoSsh: (os: string): ReactNode => (
    <>
      <b>Kone on verkossa, mutta SSH ei vastaa.</b>{" "}
      {os === "mac"
        ? "Laita etäkirjautuminen päälle (edellinen vaihe)."
        : os === "windows"
          ? "Käynnistä OpenSSH-palvelin (edellinen vaihe). Jos se on käynnissä, Windowsin palomuuri voi estää yhteyden."
          : "Käynnistä SSH-palvelin (edellinen vaihe)."}
    </>
  ),
  checkChanged: (): ReactNode => (
    <>
      <b>Koneen tunniste on eri kuin tallennettu.</b> Habitat ei jatka.
    </>
  ),
  checkFailed: (): ReactNode => (
    <>
      <b>Yhteys ei onnistunut.</b> Tarkista, että kone on hereillä, ja yritä
      uudelleen.
    </>
  ),
  joined: (name: ReactNode, address: string): ReactNode => (
    <>
      <b>Habitat on verkossasi</b> laitteena {name} ({address}).
    </>
  ),
  signInTailscale: (phone: boolean) =>
    `Kirjaudu omalla Tailscale-tunnuksellasi ja hyväksy laite.${phone ? "" : " Voit myös skannata koodin puhelimella."}`,
  openLogin: "Avaa kirjautumissivu",
  waitingApproval: "Odotetaan, että hyväksyt laitteen Tailscalessa…",
  fetchLogin: "Hae kirjautumislinkki",
  loginSoon: "Linkki tulee Tailscalelta hetkessä.",
  approval:
    "Tailscale-verkkosi ylläpitäjän pitää vielä hyväksyä laite. Hyväksy se Tailscalen hallintasivulla, niin tämä jatkuu.",
  starting: "Habitatin laite käynnistyy…",
  joins: (): ReactNode => (
    <>
      Habitat liittyy <b>omaan</b> Tailscale-verkkoosi yhtenä laitteena, ja
      agentti ottaa sen kautta yhteyden koneeseesi. Habitatilla ei ole omaa
      verkkoa eikä pääsyä verkkosi hallintaan.
    </>
  ),
  connectTailscale: "Yhdistä Tailscaleen",
  noAccount:
    "Ei vielä Tailscale-tiliä? Henkilökohtainen tili on maksuton: tailscale.com",
  installTailscale: (login?: string) =>
    `Asenna koneelle Tailscale ja kirjaudu samalla tunnuksella${login ? ` (${login})` : ""}. Valitse sitten kone:`,
  userField: "Käyttäjätunnuksesi koneella",
  userHint: "Agentti toimii koneella tällä käyttäjällä ja saa sen oikeudet.",
  userInvalid: "Tunnus ei kelpaa.",
  duration: "Pääsyn kesto",
  dated:
    "Kone lakkaa hyväksymästä avainta itsestään. Pääsyä voi jatkaa korvaamalla rivin.",
  undated: "Pääsy on voimassa, kunnes perut sen koneellasi.",
  macSteps: (user: string): ReactNode[] => [
    <>
      Avaa Macissa <b>Järjestelmäasetukset › Yleiset › Jakaminen</b>.
    </>,
    <>
      Laita <b>Etäkirjautuminen</b> päälle ja avaa sen ⓘ-painike.
    </>,
    <>
      Valitse <b>Salli pääsy: Vain nämä käyttäjät</b> ja jätä listaan vain{" "}
      {user}.
    </>,
    <>
      Jätä <b>Salli etäkäyttäjille täysi levyn käyttöoikeus</b> pois päältä.
    </>,
  ],
  windowsInstall:
    "Asenna Windowsin oma OpenSSH-palvelin ja käynnistä se. Avaa PowerShell järjestelmänvalvojana (Käynnistä-valikossa hiiren oikea › Suorita järjestelmänvalvojana) ja aja:",
  windowsSettings:
    "Saman saa Asetuksista: Järjestelmä › Valinnaiset ominaisuudet › OpenSSH-palvelin.",
  windowsVersion: (command: ReactNode): ReactNode => (
    <>
      {" "}
      Päivätty rivi vaatii OpenSSH:n version 8.2 tai uudemman; {command} kertoo
      sen. Windows 10:n mukana tullut versio voi olla vanhempi.
    </>
  ),
  linuxInstall: "Asenna SSH-palvelin ja käynnistä se (Ubuntu ja Debian):",
  fedora: "Fedorassa:",
  makingLine: "Tehdään riviä…",
  userOnMachine: (user: string) => `Käyttäjä ${user} koneella`,
  administrator: "Järjestelmänvalvoja",
  ordinaryUser: "Tavallinen käyttäjä",
  windowsAdmin: (file: ReactNode): ReactNode => (
    <>
      Windows lukee järjestelmänvalvojien avaimet yhteisestä tiedostosta {file}.
      Aja tämä komento PowerShellissä, joka on avattu järjestelmänvalvojana. Se
      lisää yhden rivin, korvaa tämän tilin aiemman rivin ja rajaa tiedoston
      oikeudet niin kuin OpenSSH vaatii.
    </>
  ),
  windowsUser: (user: string, file: ReactNode): ReactNode => (
    <>
      Aja tämä komento PowerShellissä käyttäjänä {user}. Se lisää yhden rivin
      tiedostoon {file} kotikansiossasi ja korvaa aiemman Habitat-rivin, jos
      sellainen on.
    </>
  ),
  unixCommand: (mac: boolean, user: string, file: ReactNode): ReactNode => (
    <>
      Aja tämä komento koneen {mac ? "Päätteessä" : "päätteessä"} käyttäjänä{" "}
      {user}. Se lisää yhden rivin tiedostoon {file} ja korvaa aiemman
      Habitat-rivin, jos sellainen on.
    </>
  ),
  lineParts: "Pelkkä rivi ja mitä sen osat tarkoittavat",
  restrict:
    "Ei porttien, agentin tai näytön välitystä eikä päätettä. Komennot toimivat.",
  from: (address: string) =>
    `Kelpaa vain Habitatin osoitteesta ${address} Tailscale-verkossasi.`,
  expiry: (date: string) => `Kone lakkaa hyväksymästä avainta ${date}.`,
  keyPart: (file: ReactNode, fingerprint: ReactNode): ReactNode => (
    <>
      Tilisi avain {file}, sormenjälki {fingerprint}.
    </>
  ),
  mismatch: (): ReactNode => (
    <>
      <b>Älä jatka.</b> Habitat ei tallentanut mitään. Osoitteessa vastaa jokin
      muu kuin koneesi. Tarkista, että valitsit oikean koneen ja että verkkosi
      laitteet ovat sinun.
    </>
  ),
  restart: "Aloita alusta",
  verify: (windows: boolean) =>
    `Varmista, että Habitat puhuu oikean koneen kanssa. Aja koneella${windows ? " PowerShellissä" : ""}:`,
  sameFingerprint: "Tuloksessa pitää olla sama sormenjälki kuin tässä:",
  renewTitle: (peer: string) => `Uusi pääsy: ${peer}`,
  stepsLabel: "Vaiheet",
  back: "Takaisin",
  close: "Sulje",
  noMatch: "Ei täsmää",
  saveDate: "Tallenna uusi päivä",
  save: "Tallenna",
  matches: "Täsmää, tallenna",
  next: "Seuraava",
  signInAgain: "Kirjaudu uudelleen.",
  uncertain: "Tulosta ei saatu varmistettua. Tiedot luettiin uudelleen.",
  readFailed: "Koneiden tietoja ei voitu lukea. Yritä uudelleen.",
  retry: "Yritä uudelleen",
  reading: "Luetaan koneita…",
  unknown: "ei tiedossa",
  justNow: "juuri",
  minutesAgo: (n: number) => `${n} min sitten`,
  hoursAgo: (n: number) => `${n} h sitten`,
  daysAgo: (n: number) => `${n} pv sitten`,
  errors: {
    tailscale_unavailable: "Tämä palvelin ei tarjoa Tailscalea.",
    services_unavailable:
      "Tilisi palveluita ei voitu käynnistää tällä palvelimella. Palvelimen ylläpitäjä voi korjata sen.",
    tailscale_off: "Habitat ei ole yhdistetty Tailscale-verkkoosi.",
    peer_missing: "Konetta ei enää ole Tailscale-verkossasi.",
    machine_missing: "Konetta ei enää ole Habitatissa.",
    machine_exists: "Kone on jo lisätty.",
    too_many: "Koneita on jo enimmäismäärä.",
    key_unusable:
      "Tilin SSH-avainta ~/.ssh/id_ed25519 ei voitu käyttää. Jos se on suojattu salasanalla, Habitat ei voi käyttää sitä.",
    host_key_mismatch:
      "Kone näytti nyt eri tunnisteen kuin vertasit. Mitään ei tallennettu.",
    busy: "Toinen muutos on kesken. Odota hetki.",
    failed: "Pyyntö ei onnistunut. Yritä uudelleen.",
  },
};

export const ownMachinesText = catalog(fi, {
  steps: ["Tailscale", "Machine", "Remote login", "Key line", "Confirmation"],
  forever: "Until revoked",
  days: (n) => `${n} d`,
  pill: {
    active: "Connected",
    asleep: "Not answering",
    gone: "Not in Tailscale",
    expired: "Expired",
    revoked: "Machine rejects the key",
    changed: "Identity changed",
  },
  copied: "Copied",
  copyFailed: "Did not work",
  copy: "Copy",
  truthEverything: (user, machine, until, mac) => (
    <>
      <b>On the machine the agent gets everything your user {user} gets</b>, and
      it does not ask permission for each command. Access covers only{" "}
      {machine ? `the machine ${machine}` : "the machine you choose"} and{" "}
      {until ? `ends ${until}` : "stays valid until you revoke it"}.
      {mac
        ? " Full disk access stays off, so macOS still protects the Desktop, Documents and Mail."
        : ""}
    </>
  ),
  truthRoot: () => (
    <>
      <b>The server's administrator can reach your machine the same way.</b> The
      key is in your account's home directory, and the server's administrator
      (root) can read it. Habitat cannot prevent this.
    </>
  ),
  truthCut: (node, until) => (
    <>
      <b>The sure cut is made on your machine:</b> remove the line, turn remote
      login off or remove {node} from your Tailscale network.
      {until ? ` The line also stops working by itself ${until}.` : ""} Removing
      it from Habitat alone is not enough, because the agent runs as the same
      user and may have copied the key.
    </>
  ),
  removeAsUser: "In PowerShell, if your user is an ordinary user:",
  removeAsAdmin:
    "If your user is an administrator, in PowerShell opened as administrator:",
  tsPill: {
    unavailable: "Unavailable",
    off: "Not connected",
    stopped: "Stopped",
    login: "Waiting for sign-in",
    approval: "Waiting for approval",
    starting: "Starting",
    on: "Connected",
  },
  nodeIn: (name, tailnet) => `${name} in the network ${tailnet}`,
  tsDesc: "Habitat's connection to your own network",
  tsUnavailable:
    "This server does not offer Tailscale yet. The server's administrator turns it on; you need not install anything.",
  tsStopped:
    "Habitat's Tailscale device is on your account, but it is not running.",
  start: "Start",
  tsPending: "Signing in to Tailscale is under way.",
  continue: "Continue",
  device: "Device",
  network: "Network",
  incoming: "Incoming connections",
  shieldsUp: "Blocked: your network's devices cannot reach this server",
  shieldsDown:
    "Allowed! Someone has changed the setting past Habitat. Disconnect Habitat from your network and connect again.",
  disconnectQuestion: (node) => (
    <>
      <b>Disconnect Habitat from your network?</b> Habitat stops its device and
      removes its key from this account, and all your machines from here. The
      device {node} stays in Tailscale's device list until you remove it there.
      Your machines' lines stay on the machines until you remove them or they
      expire.
    </>
  ),
  cancel: "Cancel",
  disconnect: "Disconnect",
  disconnectHabitat: "Disconnect Habitat from your network",
  habitatDevice: "Habitat's device",
  connectionOpen: "Connection open",
  expired: (date) => (
    <>
      <b>Access ended {date}.</b> The machine no longer accepts the key. Renewed
      access gives a new line that replaces the old one.
    </>
  ),
  revoked: (until) => (
    <>
      <b>The machine rejected the key</b>, although access would have been valid
      {until ? ` until ${until}` : ""}. The line has probably been removed from
      the machine or remote login is off. If you did that yourself, remove the
      machine here too.
    </>
  ),
  changed: () => (
    <>
      <b>The machine's identity differs from the saved one.</b> Habitat does not
      connect to it. If you reinstalled the machine, remove it here and add it
      again. Otherwise something other than your machine answers at the address.
    </>
  ),
  asleep: (name) => (
    <>
      <b>{name} does not answer.</b> The machine is probably asleep or Tailscale
      is closed. The agent tries again when you ask.
    </>
  ),
  gone: (name) => (
    <>
      <b>{name} is no longer in your Tailscale network.</b> The agent cannot
      reach it until it is back in the network.
    </>
  ),
  accessEnds: "Access ends",
  access: "Access",
  untilRevoked: "valid until you revoke it",
  agentOnMachine: "Agent on the machine",
  asUser: (user) => `as the user ${user}, everything ${user} gets`,
  hostKey: "Machine identity",
  missingValue: "missing",
  habitatKey: "Habitat's key",
  inTailscale: "In Tailscale",
  present: "present",
  lastSeen: (ago) => `last seen ${ago}`,
  offline: "not in the network",
  forAgent: "For the agent",
  whatItGives: "What the connection gives",
  howToCut: "How to cut access from the machine",
  removeLine: "Remove Habitat's line in the machine's terminal:",
  orStop: (os, node) =>
    `Or ${
      os === "mac"
        ? "turn off Remote Login (System Settings › General › Sharing)"
        : os === "windows"
          ? "stop the OpenSSH server (in an administrator PowerShell: Stop-Service sshd; Set-Service sshd -StartupType Disabled)"
          : "stop the SSH server (sudo systemctl disable --now ssh)"
    }, or remove the device ${node} from Tailscale's admin console.`,
  removeQuestion: (name, until) => (
    <>
      <b>Remove {name}?</b> Habitat removes the machine's connection setting and
      identity from your account. Your machine still accepts the line
      {until ? ` until ${until}` : " until you remove it"}, in case someone has
      copied the key, so remove the line from the machine too:
    </>
  ),
  removeMachine: "Remove machine",
  check: "Check connection",
  reconnect: "Reconnect",
  renew: "Renew access",
  remove: "Remove",
  intro:
    "An agent can use your own computer over SSH through your own Tailscale network, for example to check a setting or open a file. Nothing of Habitat's own is installed on your machine.",
  machines: "Machines",
  removed: (name) => (
    <>
      <b>{name} removed from Habitat.</b> Remove the line from the machine too,
      so access surely ends:
    </>
  ),
  includeFailed: (file) => (
    <>
      The file {file} could not be changed (it is probably a link). Add this
      line at its top so the agent finds the machines by name:
    </>
  ),
  none: "No connected machines.",
  add: "Add machine",
  addAnother: "Add another machine",
  addTime: "About five minutes. Have the machine beside you.",
  peerLegend: "Machine in your Tailscale network",
  peerSaved: "already added",
  peerNoSsh: "no SSH server",
  peersNote:
    "The list is from your Tailscale network. If your machine is missing, it has not signed in to the same network yet.",
  checkOk: () => (
    <>
      <b>The machine accepted the key.</b> One more check: the machine's
      identity.
    </>
  ),
  checkRejected: (user, os, dated) => (
    <>
      <b>The machine does not accept the key yet.</b> The machine answers but
      rejects the key. Run the command on the machine as the user {user} and
      check again.
      {os === "mac"
        ? ` If you ran it, check that remote login allows the user ${user}.`
        : os === "windows"
          ? ` If your user is an administrator, run the administrator's command.${dated ? " If you ran it, check OpenSSH's version (ssh -V): the line needs version 8.2 or later." : ""}`
          : ""}
    </>
  ),
  checkOffline: () => (
    <>
      <b>Tailscale does not see the machine.</b> The machine is probably asleep
      or its Tailscale is closed.
    </>
  ),
  checkNoSsh: (os) => (
    <>
      <b>The machine is in the network, but SSH does not answer.</b>{" "}
      {os === "mac"
        ? "Turn remote login on (previous step)."
        : os === "windows"
          ? "Start the OpenSSH server (previous step). If it is running, the Windows firewall may block the connection."
          : "Start the SSH server (previous step)."}
    </>
  ),
  checkChanged: () => (
    <>
      <b>The machine's identity differs from the saved one.</b> Habitat does not
      continue.
    </>
  ),
  checkFailed: () => (
    <>
      <b>The connection did not work.</b> Check that the machine is awake, and
      try again.
    </>
  ),
  joined: (name, address) => (
    <>
      <b>Habitat is in your network</b> as the device {name} ({address}).
    </>
  ),
  signInTailscale: (phone) =>
    `Sign in with your own Tailscale account and approve the device.${phone ? "" : " You can also scan the code with a phone."}`,
  openLogin: "Open the sign-in page",
  waitingApproval: "Waiting for you to approve the device in Tailscale…",
  fetchLogin: "Get a sign-in link",
  loginSoon: "The link comes from Tailscale in a moment.",
  approval:
    "Your Tailscale network's administrator still has to approve the device. Approve it in Tailscale's admin console, and this continues.",
  starting: "Habitat's device is starting…",
  joins: () => (
    <>
      Habitat joins <b>your own</b> Tailscale network as one device, and the
      agent reaches your machine through it. Habitat has no network of its own
      and no access to your network's administration.
    </>
  ),
  connectTailscale: "Connect to Tailscale",
  noAccount:
    "No Tailscale account yet? A personal account is free: tailscale.com",
  installTailscale: (login) =>
    `Install Tailscale on the machine and sign in with the same account${login ? ` (${login})` : ""}. Then choose the machine:`,
  userField: "Your username on the machine",
  userHint: "The agent works on the machine as this user and gets its rights.",
  userInvalid: "The username is not valid.",
  duration: "Access duration",
  dated:
    "The machine stops accepting the key by itself. Access can be extended by replacing the line.",
  undated: "Access stays valid until you revoke it on your machine.",
  macSteps: (user) => [
    <>
      On the Mac, open <b>System Settings › General › Sharing</b>.
    </>,
    <>
      Turn <b>Remote Login</b> on and open its ⓘ button.
    </>,
    <>
      Choose <b>Allow access for: Only these users</b> and leave only {user} in
      the list.
    </>,
    <>
      Leave <b>Allow full disk access for remote users</b> off.
    </>,
  ],
  windowsInstall:
    "Install Windows' own OpenSSH server and start it. Open PowerShell as administrator (right-click in the Start menu › Run as administrator) and run:",
  windowsSettings:
    "The same is in Settings: System › Optional features › OpenSSH Server.",
  windowsVersion: (command) => (
    <>
      {" "}
      A dated line needs OpenSSH version 8.2 or later; {command} tells it. The
      version that came with Windows 10 may be older.
    </>
  ),
  linuxInstall: "Install the SSH server and start it (Ubuntu and Debian):",
  fedora: "On Fedora:",
  makingLine: "Making the line…",
  userOnMachine: (user) => `User ${user} on the machine`,
  administrator: "Administrator",
  ordinaryUser: "Ordinary user",
  windowsAdmin: (file) => (
    <>
      Windows reads administrators' keys from the shared file {file}. Run this
      command in PowerShell opened as administrator. It adds one line, replaces
      this account's earlier line and limits the file's permissions as OpenSSH
      requires.
    </>
  ),
  windowsUser: (user, file) => (
    <>
      Run this command in PowerShell as the user {user}. It adds one line to the
      file {file} in your home folder and replaces an earlier Habitat line if
      there is one.
    </>
  ),
  unixCommand: (mac, user, file) => (
    <>
      Run this command in the machine's {mac ? "Terminal" : "terminal"} as the
      user {user}. It adds one line to the file {file} and replaces an earlier
      Habitat line if there is one.
    </>
  ),
  lineParts: "The line alone and what its parts mean",
  restrict:
    "No forwarding of ports, agent or display, and no terminal. Commands work.",
  from: (address) =>
    `Valid only from Habitat's address ${address} in your Tailscale network.`,
  expiry: (date) => `The machine stops accepting the key ${date}.`,
  keyPart: (file, fingerprint) => (
    <>
      Your account's key {file}, fingerprint {fingerprint}.
    </>
  ),
  mismatch: () => (
    <>
      <b>Do not continue.</b> Habitat saved nothing. Something other than your
      machine answers at the address. Check that you chose the right machine and
      that your network's devices are yours.
    </>
  ),
  restart: "Start over",
  verify: (windows) =>
    `Make sure Habitat is talking to the right machine. Run on the machine${windows ? " in PowerShell" : ""}:`,
  sameFingerprint: "The result must have the same fingerprint as here:",
  renewTitle: (peer) => `Renew access: ${peer}`,
  stepsLabel: "Steps",
  back: "Back",
  close: "Close",
  noMatch: "Does not match",
  saveDate: "Save the new date",
  save: "Save",
  matches: "Matches, save",
  next: "Next",
  signInAgain: "Sign in again.",
  uncertain:
    "The result could not be confirmed. The information was read again.",
  readFailed: "The machines could not be read. Try again.",
  retry: "Try again",
  reading: "Reading machines…",
  unknown: "unknown",
  justNow: "just now",
  minutesAgo: (n) => `${n} min ago`,
  hoursAgo: (n) => `${n} h ago`,
  daysAgo: (n) => `${n} d ago`,
  errors: {
    tailscale_unavailable: "This server does not offer Tailscale.",
    services_unavailable:
      "Your account's services could not be started on this server. The server's administrator can fix it.",
    tailscale_off: "Habitat is not connected to your Tailscale network.",
    peer_missing: "The machine is no longer in your Tailscale network.",
    machine_missing: "The machine is no longer in Habitat.",
    machine_exists: "The machine has already been added.",
    too_many: "There is already the maximum number of machines.",
    key_unusable:
      "The account's SSH key ~/.ssh/id_ed25519 could not be used. If it is protected with a passphrase, Habitat cannot use it.",
    host_key_mismatch:
      "The machine now showed a different identity than the one you compared. Nothing was saved.",
    busy: "Another change is under way. Wait a moment.",
    failed: "The request did not work. Try again.",
  },
});

```
