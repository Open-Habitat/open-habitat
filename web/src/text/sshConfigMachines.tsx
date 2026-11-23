import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Omat koneet: the hosts of the person's own ~/.ssh/config
// (components/SSHConfigMachines.tsx), behind the experimental switch
// own-machines-ssh-config. Aliases, addresses and paths come in as
// arguments and stay as they are.
const fi = {
  intro:
    "Agentti voi käyttää omaa tietokonettasi SSH:lla oman Tailscale-verkkosi kautta tai omilla SSH-asetuksillasi, esimerkiksi tarkistaakseen asetuksia tai avatakseen tiedoston. Koneellesi ei asenneta mitään Habitatin omaa.",
  group: "Löytyi ~/.ssh/config:sta",
  groupIntro: (file: ReactNode): ReactNode => (
    <>
      Agentti voi jo käyttää näitä yhteyksiä komennolla{" "}
      <code>ssh &lt;nimi&gt;</code>. Näytä kone täällä, niin se on sivulla omana
      koneenasi. Habitat ei muuta {file}:ia.
    </>
  ),
  show: "Näytä omana koneena",
  hide: "Piilota",
  unshow: "Poista sivulta",
  allDone: "Kaikki löydetyt on käyty läpi.",
  empty: (file: ReactNode, host: ReactNode): ReactNode => (
    <>
      {file}:ssa ei ole muita koneita. Kun lisäät sinne {host}-rivin, se näkyy
      tässä.
    </>
  ),
  unreadable: (file: ReactNode): ReactNode => (
    <>
      {file}:ia ei voitu lukea: se ei ole tavallinen, enintään 1 Mt:n tiedosto.
      Sivu ei näytä sen yhteyksiä; agentin ssh lukee sen silti tavalliseen
      tapaan.
    </>
  ),
  skipped: (n: number) => `Ohitettiin ${n}`,
  why: {
    wildcard: "kuvio, ei yksi kone",
    match: "Match-lohkoja ei tulkita",
    git_service: "Git-palvelu, ei kone",
    name: "nimeä ei voi antaa ssh:lle sellaisenaan",
    unreadable: "ei voitu lukea",
    limit: "yli rajan",
  },
  files: "Tiedostot:",
  hidden: (n: number) => `Piilotetut ${n}`,
  unhide: "Näytä taas",
  hiddenNote:
    "Piilotus koskee vain tätä sivua. Agentti voi yhä käyttää yhteyttä, koska se on ~/.ssh/config:ssa.",
  unchecked: "Ei tarkistettu",
  check: "Tarkista yhteys",
  result: {
    ok: "Vastaa",
    offline: "Ei vastaa",
    unresolved: "Nimi ei ratkea",
    hostkey_unknown: "Isäntäavain hyväksymättä",
    host_key_changed: "Isäntäavain muuttui",
    key_rejected: "Kirjautuminen ei onnistu",
    route_unsupported: "Ei tarkistettavissa täältä",
    failed: "Tarkistus ei onnistunut",
  },
  note: {
    ok: (alias: string): ReactNode => (
      <>
        Yhteys toimi ilman salasanaa. Agentti käyttää konetta komennolla{" "}
        <code>ssh {alias}</code>.
      </>
    ),
    offline: (jump?: string): ReactNode =>
      jump ? (
        <>
          Ei vastannut 10 sekunnissa <code>{jump}</code>:n kautta. Kone voi olla
          sammuksissa, tai {jump} ei pääse siihen.
        </>
      ) : (
        <>
          Ei vastannut 10 sekunnissa. Kone voi olla sammuksissa tai toisessa
          verkossa.
        </>
      ),
    unresolved: (host: string, tailscale: boolean): ReactNode =>
      tailscale ? (
        <>
          <code>{host}</code> on Tailscale-nimi, eikä palvelin ole siinä
          Tailscale-verkossa. Habitatin oma Tailscale-laite pääsee koneeseen:
          lisää se kohdasta <b>Lisää kone</b>. Tämä rivi ~/.ssh/config:ssa jää
          ennalleen.
        </>
      ) : (
        <>
          Palvelin ei löydä nimeä <code>{host}</code>.
        </>
      ),
    hostkey_unknown: (alias: string): ReactNode => (
      <>
        Koneen isäntäavain ei ole known_hostsissa, joten agentti ei voi yhdistää
        kysymättä. Habitat ei hyväksy avainta puolestasi. Avaa kerran päätteessä{" "}
        <code>ssh {alias}</code> ja vertaa sormenjälkeä koneen omaan.
      </>
    ),
    host_key_changed: (alias: string): ReactNode => (
      <>
        Kone näytti eri isäntäavaimen kuin known_hostsissa on. Habitat ei
        yhdistänyt. Selvitä syy ennen kuin avaat <code>ssh {alias}</code>{" "}
        päätteessä.
      </>
    ),
    key_rejected: (missing?: string): ReactNode =>
      missing ? (
        <>
          Kone ei hyväksynyt kirjautumista. Avaintiedostoa{" "}
          <code>{missing}</code> ei ole palvelimella, joten ssh kokeili vain
          muita avaimia.
        </>
      ) : (
        <>
          Kone ei hyväksynyt kirjautumista ilman salasanaa tai avaimen
          tunnuslausetta. Agentti ei voi kirjoittaa salasanaa.
        </>
      ),
    route_unsupported: (alias: string): ReactNode => (
      <>
        Yhteys kulkee oman välityskomennon tai usean hypyn kautta. Habitat ei
        voi pitää niitä muuttamatta known_hostsia, joten se ei yhdistänyt.
        Kokeile päätteessä <code>ssh {alias}</code>.
      </>
    ),
    failed: "Yhteyttä ei voitu tarkistaa. Kokeile päätteessä ssh-komennolla.",
  },
  keyMissing: "Avaintiedosto puuttuu",
  via: (jump: string) => `${jump}:n kautta`,
  ownCommand: "oma välityskomento",
  tailscaleName: "Tailscale-nimi",
  address: "Osoite",
  userOnMachine: "Käyttäjä koneella",
  key: "Avain",
  defaultKeys: "ssh:n oletusavaimet",
  notOnServer: " · ei palvelimella",
  route: "Reitti",
  defined: "Määritelty",
  forAgent: "Agentille",
  matchNote:
    "Tiedostossa on Match-lohkoja, joita sivu ei tulkitse. Arvot voivat poiketa siitä, mitä ssh käyttää.",
  whatHabitatKnows: "Mitä Habitat tästä tietää",
  knows: (file: ReactNode): ReactNode => (
    <>
      Rivi on omasta {file}:stasi. Habitat lukee sen, mutta ei muuta sitä, ei
      hyväksy isäntäavaimia eikä siirrä avaimia. Agentti käytti tätä konetta jo
      ennen kuin se näkyi täällä; sivu vain näyttää sen ja tarkistaa yhteyden
      pyydettäessä.
    </>
  ),
  errors: {
    feature_off: "Kokeellinen ominaisuus on pois päältä.",
    unknown_host: "Yhteyttä ei enää ole ~/.ssh/config:ssa.",
  },
};

export const sshConfigMachinesText = catalog(fi, {
  intro:
    "An agent can use your own computer over SSH through your own Tailscale network or with your own SSH settings, for example to check a setting or open a file. Nothing of Habitat's own is installed on your machine.",
  group: "Found in ~/.ssh/config",
  groupIntro: (file) => (
    <>
      The agent can already use these connections with{" "}
      <code>ssh &lt;name&gt;</code>. Show a machine here and it is on the page
      as your own machine. Habitat does not change {file}.
    </>
  ),
  show: "Show as own machine",
  hide: "Hide",
  unshow: "Remove from page",
  allDone: "Every connection found has been gone through.",
  empty: (file, host) => (
    <>
      {file} has no other machines. When you add a {host} line there, it shows
      here.
    </>
  ),
  unreadable: (file) => (
    <>
      {file} could not be read: it is not an ordinary file of at most 1 MB. The
      page does not show its connections; the agent's ssh still reads it as
      usual.
    </>
  ),
  skipped: (n) => `Skipped ${n}`,
  why: {
    wildcard: "a pattern, not one machine",
    match: "Match blocks are not interpreted",
    git_service: "a Git service, not a machine",
    name: "the name cannot be given to ssh as it is",
    unreadable: "could not be read",
    limit: "over the limit",
  },
  files: "Files:",
  hidden: (n) => `Hidden ${n}`,
  unhide: "Show again",
  hiddenNote:
    "Hiding only affects this page. The agent can still use the connection, because it is in ~/.ssh/config.",
  unchecked: "Not checked",
  check: "Check connection",
  result: {
    ok: "Answers",
    offline: "No answer",
    unresolved: "Name does not resolve",
    hostkey_unknown: "Host key not accepted",
    host_key_changed: "Host key changed",
    key_rejected: "Login fails",
    route_unsupported: "Cannot be checked from here",
    failed: "Check did not work",
  },
  note: {
    ok: (alias) => (
      <>
        The connection worked without a password. The agent uses the machine
        with <code>ssh {alias}</code>.
      </>
    ),
    offline: (jump) =>
      jump ? (
        <>
          No answer in 10 seconds through <code>{jump}</code>. The machine may
          be off, or {jump} cannot reach it.
        </>
      ) : (
        <>
          No answer in 10 seconds. The machine may be off or on another network.
        </>
      ),
    unresolved: (host, tailscale) =>
      tailscale ? (
        <>
          <code>{host}</code> is a Tailscale name, and the server is not in that
          Tailscale network. Habitat's own Tailscale device can reach the
          machine: add it from <b>Add machine</b>. This line in ~/.ssh/config
          stays as it is.
        </>
      ) : (
        <>
          The server cannot find the name <code>{host}</code>.
        </>
      ),
    hostkey_unknown: (alias) => (
      <>
        The machine's host key is not in known_hosts, so the agent cannot
        connect without asking. Habitat does not accept the key for you. Open{" "}
        <code>ssh {alias}</code> once in a terminal and compare the fingerprint
        with the machine's own.
      </>
    ),
    host_key_changed: (alias) => (
      <>
        The machine showed a different host key than known_hosts has. Habitat
        did not connect. Find out why before you open <code>ssh {alias}</code>{" "}
        in a terminal.
      </>
    ),
    key_rejected: (missing) =>
      missing ? (
        <>
          The machine did not accept the login. The key file{" "}
          <code>{missing}</code> is not on the server, so ssh only tried other
          keys.
        </>
      ) : (
        <>
          The machine did not accept a login without a password or a key
          passphrase. The agent cannot type a password.
        </>
      ),
    route_unsupported: (alias) => (
      <>
        The connection goes through your own proxy command or several hops.
        Habitat cannot keep those from changing known_hosts, so it did not
        connect. Try <code>ssh {alias}</code> in a terminal.
      </>
    ),
    failed: "The connection could not be checked. Try ssh in a terminal.",
  },
  keyMissing: "Key file missing",
  via: (jump) => `via ${jump}`,
  ownCommand: "own proxy command",
  tailscaleName: "Tailscale name",
  address: "Address",
  userOnMachine: "User on the machine",
  key: "Key",
  defaultKeys: "ssh's default keys",
  notOnServer: " · not on the server",
  route: "Route",
  defined: "Defined",
  forAgent: "For the agent",
  matchNote:
    "The file has Match blocks, which the page does not interpret. Values may differ from what ssh uses.",
  whatHabitatKnows: "What Habitat knows about this",
  knows: (file) => (
    <>
      The line is from your own {file}. Habitat reads it but does not change it,
      accept host keys or move keys. The agent used this machine before it
      showed here; the page only shows it and checks the connection when asked.
    </>
  ),
  errors: {
    feature_off: "The experimental feature is off.",
    unknown_host: "The connection is no longer in ~/.ssh/config.",
  },
});
