# text/serverIntegrations.tsx

Generated from web/src/text/serverIntegrations.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Palvelinintegraatiot: the providers' app credentials and the
// console guides (components/ServerIntegrations.tsx,
// app/ServerIntegrationsSettings.tsx, app/serverIntegrations.ts). The
// consoles' own menu and field names stay in English, as they show them.
const em = (text: string) => <em>{text}</em>;
const fi = {
  dropboxLimit:
    "Kehitystila: kun 50 henkilöä on yhdistänyt, hae tuotantotilaa kahden viikon kuluessa.",
  offered: "Tarjolla",
  notOffered: "Ei tarjolla",
  toolMissing: (tools: string) =>
    tools ? `Ei tarjolla · ${tools} puuttuu` : "Ei tarjolla · työkalu puuttuu",
  waiting: "Odottaa palvelinta",
  uncertain: "Tila epävarma",
  unknown: "Tila ei tiedossa",
  invalidAudience: (tenant: string) =>
    `kirjautujiksi on asetettu ${tenant}, mutta sovellus on nyt yhden organisaation. Anna organisaation Directory (tenant) ID.`,
  invalidTenant: "Directory (tenant) ID puuttuu tai on väärän muotoinen.",
  invalidClient: "client id puuttuu tai on väärän muotoinen.",
  invalidValues: "palvelimelle kirjoitetut arvot ovat väärän muotoiset.",
  setOnServer: "asetettu palvelimella",
  setOnServerOn: (day: string) => `asetettu palvelimella ${day}`,
  githubId: (id: string) => `GitHub-id ${id}`,
  copy: (label: string) => `Kopioi ${label}`,
  openPage: "Avaa sivu",
  apis: "API:t",
  chooseProject:
    "Valitse organisaation Google Cloud -projekti ja ota käyttöön:",
  enableInGoogle: "Ota käyttöön Google Cloudissa",
  audience: "Kohdeyleisö",
  internal:
    "Internal edellyttää Google Workspacea. Vain organisaation tilit voivat yhdistää, eikä Googlen vahvistusta tarvita.",
  scopes: "Käyttöoikeudet",
  scopesLabel: "käyttöoikeudet",
  client: "Asiakas ja tunnukset",
  inGoogle: "Google Cloudissa",
  selected: "valittu",
  agentClient:
    "Tätä asiakasta käyttävät vain agentit. Valinta ei anna lisäoikeuksia, mutta osa Googlen MCP-palveluista hyväksyy vain agentiksi merkityn asiakkaan.",
  noRedirect: (address: ReactNode): ReactNode => (
    <>Ei uudelleenohjausosoitetta. Palvelin käyttää osoitetta {address}.</>
  ),
  chooseFinally: (button: string): ReactNode => (
    <>Valitse lopuksi {em(button)}.</>
  ),
  googleShows: (window: string): ReactNode => (
    <>Google näyttää ikkunan {em(window)}:</>
  ),
  appDrafts: "Open Habitat – luonnokset",
  appRead: "Open Habitat – vain luku",
  chooseApp: (app: string): ReactNode => <>Valitse sovellus {em(app)}.</>,
  register: "Rekisteröi sovellus",
  entraSearch: (page: string): ReactNode => (
    <>
      Entran yläreunan hakukenttä vie oikealle sivulle: hae {em(page)} ja
      myöhemmin sovelluksen nimellä.
    </>
  ),
  levelApp:
    "Oma sovellus tälle tasolle: Microsoft antaa jokaiselle sovelluksen tunnukselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on raja vain omana sovelluksenaan.",
  singleTenant: "Single tenant only - <organisaatio>",
  workAccounts:
    "Vain organisaation työtilit. Henkilökohtaiset Microsoft-tilit eivät voi yhdistää.",
  leaveRedirect: (button: string): ReactNode => (
    <>Jätä Redirect URI tyhjäksi ja valitse {em(button)}.</>
  ),
  roleDeveloper: "Vaatii vähintään roolin Application Developer.",
  publicClient: "Julkinen asiakas",
  deviceCode: (button: string): ReactNode => (
    <>
      Valitse {em(button)}. Henkilöt kirjautuvat laitekoodilla, joten client
      secretiä ei luoda.
    </>
  ),
  userRead: (button: string): ReactNode => (
    <>User.Read on valmiina. Valitse lopuksi {em(button)}.</>
  ),
  consent: "Hyväksyntä ja tunnukset",
  inEntra: "Microsoft Entrassa",
  grantForOrg: "API permissions › Grant admin consent for <organisaatio> › Yes",
  noPrompt: (status: string): ReactNode => (
    <>
      Henkilöiltä ei kysytä hyväksyntää. Status-sarakkeessa lukee {em(status)}.
    </>
  ),
  grantedFor: "Granted for <organisaatio>",
  roleAdmin:
    "Vaatii roolin Cloud Application Administrator, Application Administrator tai Privileged Role Administrator.",
  overviewPage: "Sovelluksen Overview-sivulla:",
  chooseAppTab: (tab: string): ReactNode => (
    <>Valitse sovellus ja välilehti {em(tab)}.</>
  ),
  create: "Luo sovellus",
  openDropbox: "Avaa Dropbox App Console",
  appFolder:
    "Tällä tasolla henkilöt synkronoivat vain sovelluksen oman kansion (Apps/<sovelluksen nimi>). Muu Dropbox ei näy agenteille.",
  fullDropbox:
    "Henkilöt synkronoivat koko Dropboxinsa, joten App folder ei riitä.",
  dropboxNameFolder: "Open Habitat <organisaatio> sovelluskansio",
  dropboxName: "Open Habitat <organisaatio>",
  uniqueName: (button: string): ReactNode => (
    <>
      Nimen on oltava yksilöllinen, eikä siinä saa olla sanaa Dropbox. Valitse{" "}
      {em(button)}.
    </>
  ),
  dropboxOwner:
    "Sovellus kuuluu tilille, jolla luot sen. Käytä organisaation yhteistä Dropbox-tiliä.",
  dropboxScopes: (button: string): ReactNode => (
    <>
      account_info.read on valmiina. Löydät muut selaimen haulla (Ctrl+F tai
      ⌘F). Valitse lopuksi {em(button)}.
    </>
  ),
  laterChange: "Myöhempi muutos ei koske jo yhdistettyjä tilejä.",
  settingsStep: "Asetukset ja tunnukset",
  inDropbox: "Dropbox App Consolessa",
  exactAddress: (button: string): ReactNode => (
    <>
      Valitse {em(button)}. Osoitteen on oltava täsmälleen tämä, kauttaviiva
      mukaan.
    </>
  ),
  additionalUsers:
    "Uusi sovellus on kehitystilassa (Development), ja ilman tätä vain sovelluksen omistaja voi yhdistää.",
  sameSettings: "Samalla Settings-sivulla ylempänä:",
  chooseClient: (client: string): ReactNode => (
    <>Valitse asiakas {em(client)}.</>
  ),
  newSecret:
    "Google ei näytä vanhaa salaisuutta uudelleen. Lisää asiakkaalle uusi ja kopioi se ikkunasta.",
  levelOf: (provider: string, level: string) => `${provider}, taso ${level}`,
  haveClient: "Minulla on jo asiakas",
  haveApp: "Minulla on jo sovellus",
  ifNoRole: "Jos rooli puuttuu, lähetä linkki sille, jolla se on.",
  linkFills: " Linkki täyttyy, kun arvot on liitetty.",
  consentLink: "hyväksyntälinkki",
  newSecretTitle: "Uusi salaisuus",
  credentials: "Tunnukset",
  replaceEffect:
    "Yhdistetyt tilit käyttävät vanhaa salaisuutta, kunnes poistat sen Googlessa. Sen jälkeen niiden täytyy kirjautua uudelleen.",
  secretOnce:
    "Google näyttää salaisuuden vain tässä ikkunassa. Liitä se ennen kuin suljet ikkunan.",
  noSecret: "Salaisuutta ei tarvita.",
  setupTitle: (section: string, replace: boolean) =>
    `${section}: ${replace ? "vaihda tunnukset" : "aseta tunnukset"}`,
  stepOf: (n: number, total: number) => `Vaihe ${n}/${total}`,
  here: "Tähän",
  back: "Takaisin",
  cancel: "Peruuta",
  savingWait: "Odottaa palvelinta…",
  save: "Tallenna",
  next: "Seuraava",
  removeLevelTitle: (section: string) =>
    `Poistetaanko tason tunnukset (${section})?`,
  levelGone: "Tasoa ei voi enää valita yhdistettäessä.",
  levelRelogin: "Tällä tasolla yhdistetyt tilit eivät voi kirjautua uudelleen.",
  removeCredentials: "Poista tunnukset",
  removeTitle: (provider: string) => `Poistetaanko ${provider}-tunnukset?`,
  noNew: "Uusia tilejä ei voi yhdistää.",
  noRelogin: "Yhdistetyt tilit eivät voi kirjautua uudelleen.",
  syncStops: "Yhdistettyjen tilien synkronointi pysähtyy.",
  stepHidden: "Käyttöönoton vaihe piilotetaan.",
  otherLater: "Toisen sovelluksen voi asettaa poiston jälkeen.",
  fixTitle: (provider: string, tools: string) =>
    `${provider}: ${tools || "työkalu"} puuttuu`,
  runOnServer: "Aja palvelimella:",
  command: "komento",
  close: "Sulje",
  connectNote:
    "Tarjolla olevat palvelut jokainen yhdistää itse kohdassa Asetukset › Tiedot agenteille.",
  setupOff:
    "Tunnusten asetus selaimesta on poissa käytöstä palvelimen asetuksissa.",
  onboardingStep: (provider: string, hidden: boolean) =>
    `Käyttöönotto: ${provider}-vaihe${hidden ? ", piilossa" : ""}`,
  inOnboardingHidden: "Käyttöönotossa · piilossa",
  inOnboarding: "Käyttöönotossa",
  invalid: "Tunnukset eivät kelpaa:",
  refresh: "Päivitä",
  fix: "Korjaa…",
  setCredentials: "Aseta tunnukset…",
  credentialsOf: (name: string) => `${name}: tunnukset`,
  credentialsMenu: "Tunnukset",
  enableApis: "Ota API:t käyttöön Google Cloudissa",
  replaceCredentials: "Vaihda tunnukset…",
  setupDisabled: "Asetus selaimesta pois käytöstä",
  removeCredentialsMenu: "Poista tunnukset…",
  level: (level: string) => `Taso: ${level}`,
  notInUse: "Ei käytössä",
  errors: {
    googleId: "Tarkista Client ID: se päättyy .apps.googleusercontent.com.",
    googleSecret: "Tarkista Client secret.",
    dropboxKey: "Tarkista App key.",
    dropboxSecret: "Tarkista App secret.",
    microsoftClient: "Tarkista Application (client) ID: muoto 8-4-4-4-12.",
    microsoftTenant: "Tarkista Directory (tenant) ID: muoto 8-4-4-4-12.",
    sameGoogle: "Tämä on sama kuin Client ID.",
    sameMicrosoft: "Tämä on sama kuin client id.",
    sameDropbox: "Tämä on sama kuin App key.",
  },
  refusals: {
    browser_setup_disabled:
      "Tunnusten asetus selaimesta on poissa käytöstä palvelimen asetuksissa.",
    host_busy:
      "Palvelinta huolletaan juuri nyt. Mitään ei muutettu; yritä hetken päästä uudelleen.",
    integrations_file_invalid:
      "Palvelimen integraatiotiedosto vaatii ylläpitoa komentoriviltä. Mitään ei muutettu.",
    login: "Istunto on päättynyt. Kirjaudu uudelleen.",
    admin_required: "Vain ylläpitäjä voi asettaa tunnuksia.",
    invalid_request: "Palvelin ei hyväksynyt tunnuksia. Tarkista kentät.",
  } as Record<string, string>,
  refused: "Palvelin ei tehnyt muutosta.",
  sessionEnded: "Istunto on päättynyt. Kirjaudu uudelleen.",
  loadFailed: "Integraatioiden asetuksia ei voitu ladata.",
  reload: "Lataa uudelleen",
  loading: "Ladataan integraatioita…",
  refreshFailed: "Tietoja ei voitu päivittää.",
  catalogFailed: "Palvelujen tilaa ei voitu lukea.",
};

export const serverIntegrationsText = catalog(
  fi,
  {
    dropboxLimit:
      "Development mode: once 50 people have connected, apply for production within two weeks.",
    offered: "Offered",
    notOffered: "Not offered",
    toolMissing: (tools) =>
      tools ? `Not offered · ${tools} missing` : "Not offered · tool missing",
    waiting: "Waiting for the server",
    uncertain: "State uncertain",
    unknown: "State unknown",
    invalidAudience: (tenant) =>
      `the sign-in audience is set to ${tenant}, but the app is now single-organization. Give the organization's Directory (tenant) ID.`,
    invalidTenant: "the Directory (tenant) ID is missing or malformed.",
    invalidClient: "the client id is missing or malformed.",
    invalidValues: "the values written on the server are malformed.",
    setOnServer: "set on the server",
    setOnServerOn: (day) => `set on the server ${day}`,
    githubId: (id) => `GitHub id ${id}`,
    copy: (label) => `Copy ${label}`,
    openPage: "Open the page",
    apis: "APIs",
    chooseProject: "Choose the organization's Google Cloud project and enable:",
    enableInGoogle: "Enable in Google Cloud",
    audience: "Audience",
    internal:
      "Internal requires Google Workspace. Only the organization's accounts can connect, and no verification by Google is needed.",
    scopes: "Permissions",
    scopesLabel: "permissions",
    client: "Client and credentials",
    inGoogle: "In Google Cloud",
    selected: "selected",
    agentClient:
      "Only agents use this client. The choice gives no extra permissions, but some of Google's MCP services accept only a client marked as an agent.",
    noRedirect: (address) => (
      <>No redirect address. The server uses the address {address}.</>
    ),
    chooseFinally: (button) => <>Finally choose {em(button)}.</>,
    googleShows: (window) => <>Google shows the window {em(window)}:</>,
    appDrafts: "Open Habitat – drafts",
    appRead: "Open Habitat – read only",
    chooseApp: (app) => <>Choose the app {em(app)}.</>,
    register: "Register the app",
    entraSearch: (page) => (
      <>
        The search field at the top of Entra takes you to the right page: search
        for {em(page)} and later for the app's name.
      </>
    ),
    levelApp:
      "A separate app for this level: Microsoft gives every token of an app all the permissions approved for the app, so a level is a limit only as an app of its own.",
    singleTenant: "Single tenant only - <organization>",
    workAccounts:
      "Only the organization's work accounts. Personal Microsoft accounts cannot connect.",
    leaveRedirect: (button) => (
      <>Leave Redirect URI empty and choose {em(button)}.</>
    ),
    roleDeveloper: "Needs at least the Application Developer role.",
    publicClient: "Public client",
    deviceCode: (button) => (
      <>
        Choose {em(button)}. People sign in with a device code, so no client
        secret is created.
      </>
    ),
    userRead: (button) => (
      <>User.Read is there already. Finally choose {em(button)}.</>
    ),
    consent: "Consent and credentials",
    inEntra: "In Microsoft Entra",
    grantForOrg:
      "API permissions › Grant admin consent for <organization> › Yes",
    noPrompt: (status) => (
      <>
        People are not asked for consent. The Status column reads {em(status)}.
      </>
    ),
    grantedFor: "Granted for <organization>",
    roleAdmin:
      "Needs the Cloud Application Administrator, Application Administrator or Privileged Role Administrator role.",
    overviewPage: "On the app's Overview page:",
    chooseAppTab: (tab) => <>Choose the app and the tab {em(tab)}.</>,
    create: "Create the app",
    openDropbox: "Open the Dropbox App Console",
    appFolder:
      "At this level people synchronize only the app's own folder (Apps/<app name>). The rest of Dropbox is not visible to agents.",
    fullDropbox:
      "People synchronize their whole Dropbox, so App folder is not enough.",
    dropboxNameFolder: "Open Habitat <organization> app folder",
    dropboxName: "Open Habitat <organization>",
    uniqueName: (button) => (
      <>
        The name must be unique and must not contain the word Dropbox. Choose{" "}
        {em(button)}.
      </>
    ),
    dropboxOwner:
      "The app belongs to the account you create it with. Use the organization's shared Dropbox account.",
    dropboxScopes: (button) => (
      <>
        account_info.read is there already. Find the others with the browser's
        search (Ctrl+F or ⌘F). Finally choose {em(button)}.
      </>
    ),
    laterChange: "A later change does not apply to accounts already connected.",
    settingsStep: "Settings and credentials",
    inDropbox: "In the Dropbox App Console",
    exactAddress: (button) => (
      <>
        Choose {em(button)}. The address must be exactly this, slash included.
      </>
    ),
    additionalUsers:
      "A new app is in development mode (Development), and without this only the app's owner can connect.",
    sameSettings: "Higher up on the same Settings page:",
    chooseClient: (client) => <>Choose the client {em(client)}.</>,
    newSecret:
      "Google does not show the old secret again. Add a new one to the client and copy it from the window.",
    levelOf: (provider, level) => `${provider}, level ${level}`,
    haveClient: "I already have a client",
    haveApp: "I already have an app",
    ifNoRole: "If you lack the role, send the link to someone who has it.",
    linkFills: " The link fills in once the values are pasted.",
    consentLink: "consent link",
    newSecretTitle: "New secret",
    credentials: "Credentials",
    replaceEffect:
      "Connected accounts use the old secret until you delete it in Google. After that they have to sign in again.",
    secretOnce:
      "Google shows the secret only in this window. Paste it before you close the window.",
    noSecret: "No secret is needed.",
    setupTitle: (section, replace) =>
      `${section}: ${replace ? "change credentials" : "set credentials"}`,
    stepOf: (n, total) => `Step ${n}/${total}`,
    here: "Here",
    back: "Back",
    cancel: "Cancel",
    savingWait: "Waiting for the server…",
    save: "Save",
    next: "Next",
    removeLevelTitle: (section) =>
      `Remove the level's credentials (${section})?`,
    levelGone: "The level can no longer be chosen when connecting.",
    levelRelogin: "Accounts connected at this level cannot sign in again.",
    removeCredentials: "Remove credentials",
    removeTitle: (provider) => `Remove the ${provider} credentials?`,
    noNew: "No new accounts can be connected.",
    noRelogin: "Connected accounts cannot sign in again.",
    syncStops: "Synchronization of connected accounts stops.",
    stepHidden: "The onboarding step is hidden.",
    otherLater: "Another app can be set after the removal.",
    fixTitle: (provider, tools) => `${provider}: ${tools || "tool"} missing`,
    runOnServer: "Run on the server:",
    command: "command",
    close: "Close",
    connectNote:
      "Everyone connects the offered services themselves under Settings › Data for agents.",
    setupOff:
      "Setting credentials from the browser is turned off in the server's settings.",
    onboardingStep: (provider, hidden) =>
      `Onboarding: ${provider} step${hidden ? ", hidden" : ""}`,
    inOnboardingHidden: "In onboarding · hidden",
    inOnboarding: "In onboarding",
    invalid: "The credentials are not valid:",
    refresh: "Refresh",
    fix: "Fix…",
    setCredentials: "Set credentials…",
    credentialsOf: (name) => `${name}: credentials`,
    credentialsMenu: "Credentials",
    enableApis: "Enable the APIs in Google Cloud",
    replaceCredentials: "Change credentials…",
    setupDisabled: "Setting from the browser is turned off",
    removeCredentialsMenu: "Remove credentials…",
    level: (level) => `Level: ${level}`,
    notInUse: "Not in use",
    errors: {
      googleId: "Check the Client ID: it ends in .apps.googleusercontent.com.",
      googleSecret: "Check the Client secret.",
      dropboxKey: "Check the App key.",
      dropboxSecret: "Check the App secret.",
      microsoftClient:
        "Check the Application (client) ID: the form 8-4-4-4-12.",
      microsoftTenant: "Check the Directory (tenant) ID: the form 8-4-4-4-12.",
      sameGoogle: "This is the same as the Client ID.",
      sameMicrosoft: "This is the same as the client id.",
      sameDropbox: "This is the same as the App key.",
    },
    refusals: {
      browser_setup_disabled:
        "Setting credentials from the browser is turned off in the server's settings.",
      host_busy:
        "The server is under maintenance just now. Nothing was changed; try again in a moment.",
      integrations_file_invalid:
        "The server's integrations file needs maintenance from the command line. Nothing was changed.",
      login: "The session has ended. Sign in again.",
      admin_required: "Only an administrator can set credentials.",
      invalid_request:
        "The server did not accept the credentials. Check the fields.",
    },
    refused: "The server made no change.",
    sessionEnded: "The session has ended. Sign in again.",
    loadFailed: "The integrations' settings could not be loaded.",
    reload: "Reload",
    loading: "Loading integrations…",
    refreshFailed: "The information could not be refreshed.",
    catalogFailed: "The services' state could not be read.",
  },
  {
    invalidAudience: (tenant) =>
      `the sign-in audience is set to ${tenant}, but the app is now single-organisation. Give the organisation's Directory (tenant) ID.`,
    chooseProject: "Choose the organisation's Google Cloud project and enable:",
    internal:
      "Internal requires Google Workspace. Only the organisation's accounts can connect, and no verification by Google is needed.",
    singleTenant: "Single tenant only - <organisation>",
    workAccounts:
      "Only the organisation's work accounts. Personal Microsoft accounts cannot connect.",
    grantForOrg:
      "API permissions › Grant admin consent for <organisation> › Yes",
    grantedFor: "Granted for <organisation>",
    dropboxNameFolder: "Open Habitat <organisation> app folder",
    dropboxName: "Open Habitat <organisation>",
    dropboxOwner:
      "The app belongs to the account you create it with. Use the organisation's shared Dropbox account.",
  },
);

```
