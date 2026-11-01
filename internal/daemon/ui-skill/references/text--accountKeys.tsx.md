# text/accountKeys.tsx

Generated from web/src/text/accountKeys.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Avaimet (components/AccountKeys.tsx, app/AccountKeys.tsx and
// the dates of app/accountKeys.ts). Code and paths stay as they are: the
// functions place them in the sentence.
const fi = {
  sshTitle: "SSH-avain",
  sshGive:
    "Anna tämä rivi ylläpitäjälle, kun tarvitset pääsyn organisaation palvelimille. Rivi on avaimen julkinen osa, ja sen saa jakaa.",
  sshCreate: "Luo SSH-avain",
  sshMakes: (file: ReactNode, tool: ReactNode): ReactNode => (
    <>
      Tekee tiedoston {file} (ed25519) komennolla {tool}.
    </>
  ),
  ageTitle: "age-avain (SOPS)",
  ageGive:
    "Anna tämä ylläpitäjälle, kun hänen pitää lisätä tili salaisuuksien vastaanottajaksi. Sen jälkeen agenttisi voi avata ne salaisuudet, joihin sinulla on oikeus.",
  ageCreate: "Luo age-avain",
  ageMakes: (file: ReactNode, tool: ReactNode): ReactNode => (
    <>
      Tekee tiedoston {file} komennolla {tool}. SOPS löytää sen ilman
      lisäasetuksia.
    </>
  ),
  forAdmin: "Ylläpitäjälle",
  sshCheck: (command: ReactNode, fingerprint: ReactNode): ReactNode => (
    <>
      Kun hän on saanut rivin, {command} näyttää sille sormenjäljen{" "}
      {fingerprint}. Sen pitää olla sama kuin tässä.
    </>
  ),
  sshChannel:
    "Lue sormenjälki hänelle eri kanavaa pitkin kuin lähetit avaimen, esimerkiksi puhelimessa.",
  ageCheck: (file: ReactNode): ReactNode => (
    <>
      age-avaimella ei ole erillistä sormenjälkeä. Ylläpitäjä vertaa tiedostoon{" "}
      {file} lisäämäänsä riviä tähän, neljän merkin ryhmissä:
    </>
  ),
  fingerprint: "Sormenjälki",
  algorithm: "Laji",
  comment: "Kommentti",
  privatePart: (file: ReactNode): ReactNode => (
    <>
      Yksityinen osa on tilillä tiedostossa {file}. Sitä ei näytetä eikä ladata,
      eikä se lähde tililtä.
    </>
  ),
  intro: (strong: (text: string) => ReactNode): ReactNode => (
    <>
      Tämän tilin julkiset avaimet. Organisaatiosi ylläpitäjä tarvitsee niitä,
      kun hän antaa agentillesi pääsyn palvelimille tai salaisuuksiin.{" "}
      {strong("Kopioi avain tältä sivulta, älä agentin vastauksesta:")} sivu
      lukee sen suoraan tilin tiedostosta.
    </>
  ),
  key: "Avain",
  fingerprintChanged: "Sormenjälki · muutettu",
  accountKeys: "Tilin julkiset avaimet",
  toggle: (title: string, file: string, expanded: boolean) =>
    `${title} ${file}: ${expanded ? "sulje" : "näytä koko avain"}`,
  unseenBadge: "Uusi, et ole nähnyt",
  createdBadge: "Luotu juuri",
  copied: "Kopioitu",
  copy: "Kopioi",
  sendSsh: "Lähetä se ylläpitäjälle, ja kerro sormenjälki erikseen.",
  sendAge: "Lähetä se ylläpitäjälle, ja vertailkaa rivi yhdessä.",
  copyFailed: "Kopiointi ei onnistunut. Avaa rivi ja valitse avain käsin.",
  unseen: (when: string) =>
    `Tämä avain ilmestyi tilille ${when}, eikä sitä luotu tällä sivulla. Jos pyysit agenttia tekemään sen, kaikki on kunnossa. Jos et pyytänyt, älä anna sitä kenellekään ja kysy agentilta, mihin se tarvitsee sitä.`,
  recognize: "Tunnistan tämän",
  none: "Tilillä ei ole vielä julkisia avaimia.",
  missing: (title: string) => `${title} puuttuu`,
  privateStays:
    "Yksityinen osa jää tilille, eikä sitä näytetä. Olemassa olevaa avainta ei koskaan korvata.",
  noTool: (tool: ReactNode): ReactNode => (
    <>
      Tällä palvelimella ei ole ohjelmaa {tool}, joten avainta ei voi luoda
      täältä. Kerro asiasta palvelimen ylläpitäjälle.
    </>
  ),
  creating: "Luodaan…",
  openHint:
    "Avaa rivi nähdäksesi koko avaimen ja miten ylläpitäjä tarkistaa sen.",
  exists:
    "Tilillä oli jo tämä avain, eikä sitä korvattu. Avaimet luettiin uudelleen.",
  toolUnavailable:
    "Tällä palvelimella ei ole ohjelmaa, joka tekee tämän avaimen.",
  creationRunning: "Toinen avaimen luonti on kesken. Odota hetki.",
  uncertain:
    "Avaimen luonnin tulosta ei saatu varmistettua. Avaimet luettiin uudelleen.",
  readFailed: "Avaimia ei voitu lukea. Yritä uudelleen.",
  retry: "Yritä uudelleen",
  reading: "Luetaan avaimia…",
  rereadFailed:
    "Avaimia ei voitu lukea uudelleen. Näkyvissä on edellinen luku.",
  today: (time: string) => `tänään klo ${time}`,
};

export const accountKeysText = catalog(
  fi,
  {
    sshTitle: "SSH key",
    sshGive:
      "Give this line to an administrator when you need access to your organization's servers. The line is the key's public part and may be shared.",
    sshCreate: "Create SSH key",
    sshMakes: (file, tool) => (
      <>
        Makes the file {file} (ed25519) with {tool}.
      </>
    ),
    ageTitle: "age key (SOPS)",
    ageGive:
      "Give this to an administrator when they need to add the account as a recipient of secrets. After that your agent can open the secrets you are entitled to.",
    ageCreate: "Create age key",
    ageMakes: (file, tool) => (
      <>
        Makes the file {file} with {tool}. SOPS finds it without further
        settings.
      </>
    ),
    forAdmin: "For the administrator",
    sshCheck: (command, fingerprint) => (
      <>
        Once they have the line, {command} shows them the fingerprint{" "}
        {fingerprint}. It must be the same as here.
      </>
    ),
    sshChannel:
      "Read the fingerprint to them over a different channel than the one you sent the key on, for example by phone.",
    ageCheck: (file) => (
      <>
        An age key has no separate fingerprint. The administrator compares the
        line they added to {file} with this one, in groups of four characters:
      </>
    ),
    fingerprint: "Fingerprint",
    algorithm: "Type",
    comment: "Comment",
    privatePart: (file) => (
      <>
        The private part is on the account in the file {file}. It is not shown
        or downloaded, and it does not leave the account.
      </>
    ),
    intro: (strong) => (
      <>
        This account's public keys. Your organization's administrator needs them
        when they give your agent access to servers or secrets.{" "}
        {strong("Copy a key from this page, not from the agent's reply:")} the
        page reads it straight from the account's file.
      </>
    ),
    key: "Key",
    fingerprintChanged: "Fingerprint · changed",
    accountKeys: "Account public keys",
    toggle: (title, file, expanded) =>
      `${title} ${file}: ${expanded ? "close" : "show the whole key"}`,
    unseenBadge: "New, not seen by you",
    createdBadge: "Just created",
    copied: "Copied",
    copy: "Copy",
    sendSsh:
      "Send it to the administrator, and tell the fingerprint separately.",
    sendAge: "Send it to the administrator, and compare the line together.",
    copyFailed: "Copying failed. Open the row and select the key by hand.",
    unseen: (when) =>
      `This key appeared on the account ${when} and was not created on this page. If you asked an agent to make it, all is well. If you did not, give it to nobody and ask the agent what it needs it for.`,
    recognize: "I recognise this",
    none: "The account has no public keys yet.",
    missing: (title) => `${title} missing`,
    privateStays:
      "The private part stays on the account and is not shown. An existing key is never replaced.",
    noTool: (tool) => (
      <>
        This server has no {tool} program, so the key cannot be created here.
        Tell the server's administrator.
      </>
    ),
    creating: "Creating…",
    openHint:
      "Open a row to see the whole key and how an administrator checks it.",
    exists:
      "The account already had this key, and it was not replaced. The keys were read again.",
    toolUnavailable: "This server has no program that makes this key.",
    creationRunning: "Another key is being created. Wait a moment.",
    uncertain:
      "The result of creating the key could not be confirmed. The keys were read again.",
    readFailed: "The keys could not be read. Try again.",
    retry: "Try again",
    reading: "Reading the keys…",
    rereadFailed:
      "The keys could not be read again. The previous reading is shown.",
    today: (time) => `today at ${time}`,
  },
  {
    sshGive:
      "Give this line to an administrator when you need access to your organisation's servers. The line is the key's public part and may be shared.",
    intro: (strong) => (
      <>
        This account's public keys. Your organisation's administrator needs them
        when they give your agent access to servers or secrets.{" "}
        {strong("Copy a key from this page, not from the agent's reply:")} the
        page reads it straight from the account's file.
      </>
    ),
  },
);

```
