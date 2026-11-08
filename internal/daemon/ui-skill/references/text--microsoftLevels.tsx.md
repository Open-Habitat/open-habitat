# text/microsoftLevels.tsx

Generated from web/src/text/microsoftLevels.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// Palvelinintegraatiot: what each account level allows (the comparison
// table) and Microsoft 365's guided setup of its four Entra applications
// (components/MicrosoftLevels.tsx). Entra's own labels stay in English in
// both languages, since the administrator finds them on Entra's pages.
const fi = {
  title: "Microsoft 365: tasojen sovellukset",
  /** A level's short name, where four of them sit in one row. */
  short: {
    full: "Täysi",
    nosend: "Ei lähetystä",
    drafts: "Luonnokset",
    read: "Vain luku",
  } as Record<string, string>,
  /** The name each level's application gets in Entra. */
  app: {
    full: "Open Habitat – täysi",
    nosend: "Open Habitat – ei lähetystä",
    drafts: "Open Habitat – luonnokset",
    read: "Open Habitat – vain luku",
  } as Record<string, string>,

  // The comparison table.
  ability: "Oikeus",
  services: {
    microsoft: {
      mail: "Outlook-posti",
      calendar: "Outlook-kalenteri",
      contacts: "Yhteystiedot",
      files: "OneDrive ja SharePoint",
    },
    google: {
      mail: "Gmail",
      calendar: "Google-kalenteri",
      contacts: "Google-yhteystiedot",
      files: "Google Drive",
    },
    dropbox: { mail: "", calendar: "", contacts: "", files: "Dropbox" },
  } as Record<string, Record<string, string>>,
  reads: "Lukee",
  sees: "Näkee",
  organises: "Järjestelee ja luonnostelee",
  sends: "Lähettää",
  changesAndSends: "Muuttaa ja lähettää",
  gmailWarn: "Gmail ei erota muutoksia lähettämisestä",
  editsEvents: "Muokkaa tapahtumia",
  inviteAlways: "Osallistujat saavat aina kutsun",
  inviteMay: "Voi lähettää osallistujille kutsun",
  edits: "Muokkaa",
  editsShares: "Muokkaa ja voi jakaa",
  linkWarn: "Jakolinkki voi avautua kenelle tahansa, jos organisaatio sallii",
  shareWarn: "Jakaminen sisältyy muokkaukseen",
  shares: "Jakaa",
  yes: "Kyllä",
  no: "Ei",
  appFolderOnly: "Vain sovelluskansio",
  whatLevelsAllow: "Mitä tasot sallivat",
  hideLevels: "Piilota tasot",
  offered: "Tarjolla",
  noCredentials: "Ei tunnuksia",

  // The page's Microsoft row.
  levelsSet: (n: number, names: string) => `${n}/4 tasoa asetettu: ${names}`,
  fourLevels: "Neljä tasoa. Jokainen on Entrassa oma sovelluksensa.",
  levelsOf: (names: string) => `Tasot: ${names}`,
  partlyOffered: (n: number) => `${n}/4 tasoa tarjolla`,
  createApps: "Luo sovellukset…",
  setMissing: "Aseta puuttuvat…",
  levels: "Tasot",

  // The start page.
  saved: "Tallennettu:",
  allSet: "Kaikilla neljällä tasolla on tunnukset.",
  tick: "Rastita tasot, jotka asetat nyt. Jokainen rastitettu käydään läpi kokonaan.",
  how: "Jokainen taso on Entrassa oma sovelluksensa. Taso on asetettu, kun sen tunnukset on tallennettu palvelimelle; sitä ei tehdä uudelleen.",
  setMark: "Asetettu",
  setNow: "Aseta nyt",
  begin: (n: number) =>
    `Aloita: ${n} ${plural("fi", n, { one: "taso", other: "tasoa" })}`,
  chooseLevel: "Valitse taso",
  cancel: "Peruuta",
  done: "Valmis",
  close: "Sulje",
  remove: "Poista",
  removeOf: (level: string) => `Poista tason ${level} tunnukset`,
  unusable: "Tunnukset eivät kelpaa:",
  locked: "Selaimesta asettaminen on pois päältä tällä palvelimella.",

  // The walk.
  rail: "Sovellukset tässä asetuksessa",
  railItem: (i: number, app: string, saved: boolean) =>
    `${i}. ${app}${saved ? ", tallennettu" : ""}`,
  items: (n: number) => `${n} kohtaa`,
  skipped: (names: string) => `Ei tässä asetuksessa: ${names}`,
  skippedShort: (n: number) => `+${n} ohitetaan`,
  stepOf: (n: number) => `Vaihe ${n}/4`,
  steps: [
    "Rekisteröi sovellus",
    "Julkinen asiakas",
    "Käyttöoikeudet",
    "Hyväksyntä ja tunnukset",
  ],
  stepperLabel: (title: string) => `${title}: kohdat`,
  back: "Takaisin",
  save: "Tallenna",
  saveNext: "Tallenna ja jatka",
  saveNextTo: (level: string) => `Tallenna ja jatka: ${level}`,
  nextStep: "Seuraava vaihe",
  nextStepTo: (title: string) => `Seuraava vaihe: ${title}`,
  next: "Seuraava",
  nextTo: (name: string) => `Seuraava: ${name}`,
  saving: "Tallennetaan…",
  haveApp: "Minulla on jo sovellus",
  copy: (label: string) => `Kopioi ${label}`,
  openList: (name: string) => `Avaa ${name}`,
  doneWhen: (rest: ReactNode) => (
    <>
      <strong>Valmis, kun</strong> {rest}
    </>
  ),
  missing: (what: string) => (
    <>
      <strong>Kuva puuttuu:</strong> {what}.
    </>
  ),
  missingFrom: "Kuvassa sivu, josta se avautuu.",
  missingPlatform:
    "Add Redirect URI › Mobile and desktop applications -paneeli",
  missingRequest:
    "Request API permissions -paneeli (Microsoft Graph › Delegated permissions)",
  missingSelect: "Select permissions -haku ja Add permissions",
  missingConsent: "Grant admin consent -vahvistus (Yes)",
  alt: {
    register: "Entra: Register an application",
    list: "Entra: App registrations, All applications",
    overview: "Entra: sovelluksen Overview",
    auth: "Entra: sovelluksen Authentication (Preview)",
    perms: "Entra: sovelluksen API permissions",
  } as Record<string, string>,
  doneItem: "Valmis",
  permissionsName: (n: number) => `Oikeudet (${n})`,

  pickFirst: (button: ReactNode) => <>Valitse listan yläpuolelta {button}.</>,
  pickAgain: (list: string, button: ReactNode) => (
    <>
      Palaa listaan {list} ja valitse {button}.
    </>
  ),
  roleDeveloper: "Vaatii vähintään roolin Application Developer.",
  roleAdmin:
    "Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.",
  typeName: "Kirjoita nimeksi",
  ownApp:
    "Jokainen taso on oma sovelluksensa, koska Microsoft antaa kirjautumiselle aina kaikki sovellukselle hyväksytyt oikeudet.",
  chooseIfNot: "Valitse, jos ei ole jo valittuna",
  singleTenant: "Single tenant only - <organisaatio>",
  orgMasked: "<organisaatio> on organisaatiosi nimi; kuvissa se on peitetty.",
  leaveEmpty: (field: ReactNode) => (
    <>Jätä {field} tyhjäksi. Osoite lisätään seuraavassa vaiheessa.</>
  ),
  pickBottom: (button: ReactNode) => <>Valitse sivun alareunasta {button}.</>,
  appOpens: (app: ReactNode) => (
    <>
      Entra avaa sovelluksen {app}: otsikkona sen nimi ja vasemmalla sen oma
      valikko.
    </>
  ),
  fromMenu: (item: ReactNode) => (
    <>Valitse sovelluksen vasemmasta valikosta {item}.</>
  ),
  addRedirect: (add: ReactNode, kind: ReactNode, configure: ReactNode) => (
    <>
      Valitse {add}, sitten {kind}. Rastita ehdotuksista tämä osoite ja valitse{" "}
      {configure}.
    </>
  ),
  publicFlows: (
    tab: ReactNode,
    field: ReactNode,
    enabled: ReactNode,
    save: ReactNode,
  ) => (
    <>
      Valitse välilehti {tab}. Kohdassa {field} valitse {enabled} ja {save}.
    </>
  ),
  publicDone: (uris: ReactNode, settings: ReactNode, flows: ReactNode) => (
    <>
      {uris}-välilehdellä näkyy tämä osoite, ja {settings}-välilehdellä {flows}.
    </>
  ),
  addPermission: (add: ReactNode, graph: ReactNode, kind: ReactNode) => (
    <>
      Valitse {add}, sitten {graph} ja {kind}.
    </>
  ),
  oneByOne: (search: ReactNode, add: ReactNode) => (
    <>
      Haku {search} löytää yhden kerrallaan: kopioi, liitä ja rastita. Lopuksi{" "}
      {add}.
    </>
  ),
  permCount: (n: number) => `${n} oikeutta · User.Read on taulukossa valmiina`,
  groupRow: (graph: ReactNode) => <>ryhmärivillä lukee {graph}.</>,
  grant: (grant: ReactNode, yes: ReactNode) => (
    <>
      Valitse samalla sivulla {grant}, sitten {yes}.
    </>
  ),
  granted: (granted: ReactNode) => (
    <>Status-sarakkeessa lukee jokaisella rivillä {granted}.</>
  ),
  grantFor: "Grant admin consent for <organisaatio>",
  grantedFor: "Granted for <organisaatio>",
  copyClient: (overview: ReactNode, client: ReactNode) => (
    <>
      Valitse vasemmasta valikosta {overview}, kopioi {client} ja liitä se
      tähän.
    </>
  ),
  copyTenant: (tenant: ReactNode) => (
    <>
      Kopioi {tenant} ja liitä se tähän. Se on kaikille neljälle sama, joten
      sitä ei kysytä uudelleen.
    </>
  ),
  knownTenant: (tenant: ReactNode, level: ReactNode) => (
    <>
      {tenant} on kaikille neljälle sama. Se on jo tallennettu tasolle {level},
      joten sitä ei tarvitse kopioida.
    </>
  ),
  noSecret: "Salaisuutta ei tarvita.",
  ifNoRole: "Jos rooli puuttuu, lähetä hyväksyntälinkki sille, jolla se on.",
  linkFills: "Linkki täyttyy, kun tunnukset on liitetty.",
  consentLink: "hyväksyntälinkki",
  sameClient: (app: string) =>
    `Sama tunnus kuin sovelluksella ${app}. Jokaisella tasolla on oma sovelluksensa ja oma tunnuksensa.`,
};

export const microsoftLevelsText = catalog(
  fi,
  {
    title: "Microsoft 365: the levels' apps",
    short: {
      full: "Full",
      nosend: "No sending",
      drafts: "Drafts",
      read: "Read only",
    },
    app: {
      full: "Open Habitat – full",
      nosend: "Open Habitat – no sending",
      drafts: "Open Habitat – drafts",
      read: "Open Habitat – read only",
    },
    ability: "Permission",
    services: {
      microsoft: {
        mail: "Outlook mail",
        calendar: "Outlook calendar",
        contacts: "Contacts",
        files: "OneDrive and SharePoint",
      },
      google: {
        mail: "Gmail",
        calendar: "Google Calendar",
        contacts: "Google Contacts",
        files: "Google Drive",
      },
      dropbox: { mail: "", calendar: "", contacts: "", files: "Dropbox" },
    },
    reads: "Reads",
    sees: "Sees",
    organises: "Organizes and drafts",
    sends: "Sends",
    changesAndSends: "Changes and sends",
    gmailWarn: "Gmail does not separate changes from sending",
    editsEvents: "Edits events",
    inviteAlways: "Attendees always get an invitation",
    inviteMay: "Can send attendees an invitation",
    edits: "Edits",
    editsShares: "Edits and can share",
    linkWarn: "A sharing link may open for anyone, if the organization allows",
    shareWarn: "Sharing comes with editing",
    shares: "Shares",
    yes: "Yes",
    no: "No",
    appFolderOnly: "App folder only",
    whatLevelsAllow: "What the levels allow",
    hideLevels: "Hide levels",
    offered: "Offered",
    noCredentials: "No credentials",
    levelsSet: (n, names) => `${n}/4 levels set: ${names}`,
    fourLevels: "Four levels. Each is its own app in Entra.",
    levelsOf: (names) => `Levels: ${names}`,
    partlyOffered: (n) => `${n}/4 levels offered`,
    createApps: "Create the apps…",
    setMissing: "Set the missing ones…",
    levels: "Levels",
    saved: "Saved:",
    allSet: "All four levels have credentials.",
    tick: "Tick the levels you set now. Each ticked one is walked through in full.",
    how: "Each level is its own app in Entra. A level is set once its credentials are saved on the server; it is not done again.",
    setMark: "Set",
    setNow: "Set now",
    begin: (n) =>
      `Start: ${n} ${plural("en", n, { one: "level", other: "levels" })}`,
    chooseLevel: "Choose a level",
    cancel: "Cancel",
    done: "Done",
    close: "Close",
    remove: "Remove",
    removeOf: (level) => `Remove the credentials of level ${level}`,
    unusable: "The credentials are not valid:",
    locked:
      "Setting credentials from the browser is turned off on this server.",
    rail: "Apps in this setup",
    railItem: (i, app, saved) => `${i}. ${app}${saved ? ", saved" : ""}`,
    items: (n) => `${n} items`,
    skipped: (names) => `Not in this setup: ${names}`,
    skippedShort: (n) => `+${n} skipped`,
    stepOf: (n) => `Step ${n}/4`,
    steps: [
      "Register the app",
      "Public client",
      "Permissions",
      "Consent and credentials",
    ],
    stepperLabel: (title) => `${title}: items`,
    back: "Back",
    save: "Save",
    saveNext: "Save and continue",
    saveNextTo: (level) => `Save and continue: ${level}`,
    nextStep: "Next step",
    nextStepTo: (title) => `Next step: ${title}`,
    next: "Next",
    nextTo: (name) => `Next: ${name}`,
    saving: "Saving…",
    haveApp: "I already have an app",
    copy: (label) => `Copy ${label}`,
    openList: (name) => `Open ${name}`,
    doneWhen: (rest) => (
      <>
        <strong>Done when</strong> {rest}
      </>
    ),
    missing: (what) => (
      <>
        <strong>No picture:</strong> {what}.
      </>
    ),
    missingFrom: "The picture shows the page it opens from.",
    missingPlatform:
      "the Add Redirect URI › Mobile and desktop applications panel",
    missingRequest:
      "the Request API permissions panel (Microsoft Graph › Delegated permissions)",
    missingSelect: "the Select permissions search and Add permissions",
    missingConsent: "the Grant admin consent confirmation (Yes)",
    alt: {
      register: "Entra: Register an application",
      list: "Entra: App registrations, All applications",
      overview: "Entra: the app's Overview",
      auth: "Entra: the app's Authentication (Preview)",
      perms: "Entra: the app's API permissions",
    },
    doneItem: "Done",
    permissionsName: (n) => `Permissions (${n})`,
    pickFirst: (button) => <>Choose {button} above the list.</>,
    pickAgain: (list, button) => (
      <>
        Go back to the list {list} and choose {button}.
      </>
    ),
    roleDeveloper: "Needs at least the Application Developer role.",
    roleAdmin:
      "Needs the Cloud Application Administrator, Application Administrator or Privileged Role Administrator role.",
    typeName: "Type the name",
    ownApp:
      "Each level is its own app, because Microsoft always gives a sign-in every permission the app was granted.",
    chooseIfNot: "Choose, if not already chosen",
    singleTenant: "Single tenant only - <organization>",
    orgMasked:
      "<organization> is your organization's name; it is masked in the pictures.",
    leaveEmpty: (field) => (
      <>Leave {field} empty. The address is added in the next step.</>
    ),
    pickBottom: (button) => <>Choose {button} at the bottom of the page.</>,
    appOpens: (app) => (
      <>
        Entra opens the app {app}: its name as the title and its own menu on the
        left.
      </>
    ),
    fromMenu: (item) => <>Choose {item} in the app's left menu.</>,
    addRedirect: (add, kind, configure) => (
      <>
        Choose {add}, then {kind}. Tick this address among the suggestions and
        choose {configure}.
      </>
    ),
    publicFlows: (tab, field, enabled, save) => (
      <>
        Choose the {tab} tab. Under {field} choose {enabled} and {save}.
      </>
    ),
    publicDone: (uris, settings, flows) => (
      <>
        the {uris} tab shows this address, and on the {settings} tab {flows}.
      </>
    ),
    addPermission: (add, graph, kind) => (
      <>
        Choose {add}, then {graph} and {kind}.
      </>
    ),
    oneByOne: (search, add) => (
      <>
        The {search} search finds one at a time: copy, paste and tick. Finally{" "}
        {add}.
      </>
    ),
    permCount: (n) => `${n} permissions · User.Read is in the table already`,
    groupRow: (graph) => <>the group row reads {graph}.</>,
    grant: (grant, yes) => (
      <>
        Choose {grant} on the same page, then {yes}.
      </>
    ),
    granted: (granted) => <>every row of the Status column reads {granted}.</>,
    grantFor: "Grant admin consent for <organization>",
    grantedFor: "Granted for <organization>",
    copyClient: (overview, client) => (
      <>
        Choose {overview} in the left menu, copy {client} and paste it here.
      </>
    ),
    copyTenant: (tenant) => (
      <>
        Copy {tenant} and paste it here. It is the same for all four, so it is
        not asked again.
      </>
    ),
    knownTenant: (tenant, level) => (
      <>
        {tenant} is the same for all four. It is already saved with level{" "}
        {level}, so there is no need to copy it.
      </>
    ),
    noSecret: "No secret is needed.",
    ifNoRole:
      "If you lack the role, send the consent link to someone who has it.",
    linkFills: "The link fills in once the credentials are pasted.",
    consentLink: "consent link",
    sameClient: (app) =>
      `The same id as the app ${app}. Each level has its own app and its own id.`,
  },
  {
    organises: "Organises and drafts",
    linkWarn: "A sharing link may open for anyone, if the organisation allows",
    singleTenant: "Single tenant only - <organisation>",
    orgMasked:
      "<organisation> is your organisation's name; it is masked in the pictures.",
    grantFor: "Grant admin consent for <organisation>",
    grantedFor: "Granted for <organisation>",
  },
);

```
