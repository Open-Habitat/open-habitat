# text/integrations.tsx

Generated from web/src/text/integrations.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Tiedot agenteille and the integration onboarding steps
// (components/Integrations.tsx). Provider and product names stay as they
// are; Finnish also needs a provider's genitive and illative.
const fi = {
  providers: {
    atlassian: {
      name: "Atlassian",
      site: "Atlassian",
      gen: "Atlassianin",
      ill: "Atlassianiin",
    },
    trello: { name: "Trello", site: "Trello", gen: "Trellon", ill: "Trelloon" },
    google: { name: "Google", site: "Google", gen: "Googlen", ill: "Googleen" },
    microsoft: {
      name: "Microsoft 365",
      site: "Microsoft",
      gen: "Microsoftin",
      ill: "Microsoft 365:een",
    },
    imap: {
      name: "Sähköposti (IMAP)",
      site: "Postipalvelin",
      gen: "postipalvelimen",
      ill: "postipalvelimelle",
    },
    caldav: {
      name: "Kalenteri (CalDAV)",
      site: "DAV-palvelin",
      gen: "DAV-palvelimen",
      ill: "DAV-palvelimelle",
    },
    carddav: {
      name: "Yhteystiedot (CardDAV)",
      site: "DAV-palvelin",
      gen: "DAV-palvelimen",
      ill: "DAV-palvelimelle",
    },
    dropbox: {
      name: "Dropbox",
      site: "Dropbox",
      gen: "Dropboxin",
      ill: "Dropboxiin",
    },
    apple: {
      name: "Apple (iCloud)",
      site: "Apple",
      gen: "Applen",
      ill: "iCloudiin",
    },
    gitea: { name: "Gitea", site: "Gitea", gen: "Gitean", ill: "Giteaan" },
    gitlab: {
      name: "GitLab",
      site: "GitLab",
      gen: "GitLabin",
      ill: "GitLabiin",
    },
  },
  services: {
    atlassian: { jira: "Jira-tehtävät", confluence: "Confluence-sivut" },
    trello: { trello: "Trello-taulut ja -kortit" },
    google: {
      mail: "Gmail",
      calendar: "Google-kalenteri",
      contacts: "Google-yhteystiedot",
      drive: "Google Drive",
    },
    microsoft: {
      mail: "Outlook-posti",
      calendar: "Outlook-kalenteri",
      contacts: "Yhteystiedot",
      onedrive: "OneDrive ja SharePoint",
      sharepoint: "SharePoint",
    },
    imap: {
      mail: "Posti",
      calendar: "Kalenteri (CalDAV)",
      contacts: "Yhteystiedot (CardDAV)",
    },
    caldav: { calendar: "Kalenteri (CalDAV)" },
    carddav: { contacts: "Yhteystiedot (CardDAV)" },
    dropbox: { dropbox: "Dropbox" },
    apple: {
      mail: "iCloud Mail",
      calendar: "iCloud-kalenteri",
      contacts: "iCloud-yhteystiedot",
    },
    gitea: { git: "Git-repot työtiloiksi" },
    gitlab: { git: "gitlab.com tai yrityksen oma GitLab" },
  } as Record<string, Record<string, string>>,
  cloudFolder:
    "OneDriven tai Dropboxin synkronoitu kansio välittää tiedostoja oman koneesi ja agentin välillä. Jaa siellä esimerkiksi kuvakaappauksia, tai pyydä agenttia tallentamaan sinne sähköpostiliitteet, jotka haluat omalle koneellesi. Synkronoi sama kansio myös omalla koneellasi.",
  notGranted: "Ei myönnetty. Agentit eivät pääse tähän.",
  drafts: "Lukee, järjestelee ja kirjoittaa luonnoksia. Ei voi lähettää.",
  readFiles:
    "Vain luku. Kansio on peili: muutokset eivät palaa palveluun, ja seuraava synkronointi kirjoittaa ne yli.",
  readMail: "Vain luku. Ei voi muuttaa eikä lähettää mitään.",
  readCalendar: "Vain luku. Ei voi luoda tapahtumia eikä lähettää kutsuja.",
  readOnly: "Vain luku.",
  levels: {
    atlassian: {
      read: {
        name: "Vain luku",
        sum: "Pyydä luku- ja hakuoikeuksia. Tarkista myönnetyt oikeudet kirjautumisen jälkeen: Atlassian voi pyytää laajempaa lupaa.",
      },
      full: {
        name: "Luku ja muokkaus",
        sum: "Pyydä Jira-tehtävien ja Confluence-sivujen luku- ja muokkausoikeuksia. Organisaation ja kohteen oikeudet rajoittavat käyttöä edelleen.",
      },
    },
    trello: {
      read: {
        name: "Vain luku",
        sum: "Pyydä vain lukuoikeuksia. Pi pyytää lupaa, mutta ei voi rajata sitä: Trello voi myöntää enemmän. Kirjoitusta voi estää varmasti vain organisaation ylläpitäjä Atlassianin MCP-asetuksista. Yhteys näyttää myönnetyn luvan.",
      },
      full: {
        name: "Luku ja muokkaus",
        sum: "Pyydä taulujen, korttien, Inboxin ja Plannerin luku- ja muokkausoikeuksia, ei Workspacen hallintaa. Workspacen ja taulun oikeudet rajoittavat käyttöä edelleen.",
      },
    },
    microsoft: {
      full: {
        name: "Täysi",
        sum: "Agentit voivat lukea, muokata ja lähettää sinun nimissäsi.",
      },
      nosend: {
        name: "Kaikki paitsi postin lähetys",
        sum: "Agentit voivat lukea ja muokata kaikkea ja kirjoittaa postiluonnoksia, mutta eivät lähettää postia. Kalenterin muutos lähettää silti kutsut, ja tiedoston voi jakaa.",
      },
      drafts: {
        name: "Luonnokset, muu vain luku",
        sum: "Agentit lukevat ja kirjoittavat postiluonnoksia. Tililtä ei lähde mitään: ei postia, kalenterikutsuja eikä jakolinkkejä.",
      },
      read: {
        name: "Vain luku",
        sum: "Agentit lukevat postia, kalenteria, yhteystietoja ja tiedostoja, mutta eivät muuta mitään.",
      },
    },
    google: {
      full: {
        name: "Täysi",
        sum: "Agentit voivat lukea, muokata ja lähettää sinun nimissäsi.",
      },
      drafts: { name: "Luonnokset, ei lähetystä", sum: "" },
      read: {
        name: "Vain luku",
        sum: "Agentit lukevat Gmailia, kalenteria, yhteystietoja ja Drivea, mutta eivät muuta mitään.",
      },
    },
    dropbox: {
      full: {
        name: "Koko Dropbox",
        sum: "Agentit voivat lukea, muokata, poistaa ja jakaa kaikkia tiedostojasi.",
      },
      app_folder: {
        name: "Vain sovelluskansio",
        sum: "Agentit näkevät vain sovelluksen oman kansion Dropboxin Apps-kansiossa. Muu Dropboxisi ei näy niille lainkaan.",
      },
      read: {
        name: "Vain luku",
        sum: "Agentit lukevat kaikkia tiedostojasi, mutta eivät muuta, poista tai jaa niitä.",
      },
    },
  } as Record<string, Record<string, { name: string; sum: string }>>,
  appFolder:
    "Vain sovelluksen kansio, synkronoituu molempiin suuntiin. Muu Dropbox ei näy.",
  syncBoth:
    "Synkronoituu kotihakemistoosi molempiin suuntiin. Agentit voivat muokata, poistaa ja jakaa.",
  mirror:
    "Peili: tiedostot kopioituvat kotihakemistoosi, mutta muutokset eivät palaa. Kansioon tehty muutos kirjoittuu seuraavalla kierroksella yli.",
  mailFull: "Lukee, järjestelee, kirjoittaa luonnoksia ja lähettää.",
  calendarFull: "Lukee ja muokkaa. Tapahtuma osallistujineen lähettää kutsut.",
  full: "Lukee ja muokkaa.",
  custom: "Mukautettu",
  without: (level: string, services: string) => `${level}, ilman: ${services}`,
  missingSend: (name: string) => `${name}: lähetys`,
  missingEdit: (name: string) => `${name}: muokkaus`,
  readFolder: (folder: ReactNode): ReactNode => (
    <>
      Vain luku. Kansio {folder} on peili: muutokset eivät palaa palveluun, ja
      seuraava synkronointi kirjoittaa ne yli.
    </>
  ),
  folder: (folder: ReactNode): ReactNode => (
    <>
      Kansio {folder}, jota agentit käyttävät tavallisilla tiedostotyökaluilla
    </>
  ),
  himalaya: (command: ReactNode): ReactNode => (
    <>
      Agentit hakevat ja lukevat postia ja tekevät luonnoksia komennolla{" "}
      {command}
    </>
  ),
  skill: "Agentit käyttävät tätä taidon personal-data kautta",
  codeHosts: "Koodipalvelut",
  dataForAgents: "Tiedot agenteille",
  limitsLead:
    "Agentit voivat käyttää kaikkea, minkä palvelu myönsi tähän liittämillesi tileille.",
  limitsBody:
    "Ne voivat lähettää postia, muuttaa kalenteria ja muokata tai poistaa tiedostoja sinun nimissäsi, jos myöntö sen sallii, ja liitetty viesti tai tiedosto voi sisältää ohjeita, joita agentti yrittää noudattaa. Myönnetty oikeus on palvelun oma raja: se pitää, vaikka agentti erehtyisi tai sitä yritettäisiin ohjata. Se ei estä tätä:",
  limitHome:
    "Agentit ajavat sinun käyttäjänäsi, joten ne voivat lukea myös kirjautumistiedot kotihakemistostasi. Jos tieto päätyy muualle, sillä voi tehdä saman kuin agentti, ei enempää.",
  limitTell:
    "Agentti voi kertoa eteenpäin kaiken, mitä se saa lukea. Vain luku ei estä lukemista.",
  limitModes:
    "Agentin työkalujen omat ”turvatilat” ovat ohjeita, eivät rajoja. Raja on se, minkä palvelu myönsi.",
  narrowedOrg: (missing: string): ReactNode => (
    <>
      <strong>Organisaatiosi on rajannut Habitatin oikeuksia.</strong> Puuttuu:{" "}
      {missing}. Yhteys toimii myönnetyillä oikeuksilla. Rajaus muutetaan
      organisaation Microsoft Entra -hallinnassa, ei täällä.
    </>
  ),
  narrowedSelf: (missing: string): ReactNode => (
    <>
      <strong>Kirjautuessa jäi myöntämättä:</strong> {missing}. Agentit eivät
      pääse niihin. Kirjaudu uudelleen ja myönnä ne, jos haluat. Google
      Workspacen ylläpitäjä voi myös rajata oikeuksia.
    </>
  ),
  granted: (n: number) => `Myönnetyt oikeudet (${n})`,
  askedNotGranted: "pyydettiin, ei myönnetty",
  warnLead: "Agentit voivat lukea ja käyttää kaikkea, mitä tähän liität.",
  warnBody:
    "Ne voivat lähettää postia, muuttaa kalenteria ja muokata tai poistaa tiedostoja sinun nimissäsi. Liitetty viesti tai tiedosto voi myös sisältää ohjeita, joita agentti yrittää noudattaa. Liitä vain se, mitä haluat agenttien käyttävän.",
  state: {
    ok: "Toimii",
    syncing: "Synkronoi",
    sync_failed: "Synkronointi epäonnistui",
    credentials_rejected: "Tunnus tai salasana ei kelpaa",
    login_expired: "Kirjautuminen vanhentunut",
    unreachable: "Palvelimeen ei saada yhteyttä",
    sync_restarting: "Synkronointi pysähtyi, käynnistetään uudelleen",
    quota_full: "Kiintiö täynnä, synkronointi pysähtyi",
    unknown: "Tilaa ei saatu selville",
    pending_first_sync: "Tarkistetaan ensimmäisen synkronoinnin jälkeen",
  } as Record<string, string>,
  failure: {
    quota_insufficient: "Valitut tiedostot eivät mahdu kiintiöön",
    quota_unavailable: "Vapaata tilaa ei voitu tarkistaa",
    initial_sync_incomplete: "Ensimmäinen synkronointi jäi kesken",
    not_chosen: "Ei synkronoida",
    initial_sync_resume_failed:
      "Ensimmäisen synkronoinnin jatkaminen epäonnistui",
    delete_limit: "Pysäytetty: liian monta poistoa kerralla",
    all_changed:
      "Kaikki tiedostot muuttuivat kerralla, tarkistetaan ja jatketaan",
    needs_resync: "Pysähtyi eikä jatku itsestään",
    remote_unreachable: "Palveluun ei saada yhteyttä, yritetään uudelleen",
    pass_failed: "Viimeisin synkronointi epäonnistui, yritetään uudelleen",
    app_changed: "Kirjaudu uudelleen",
    tenant_changed: "Kirjaudu uudelleen",
    outside_tenant: "Ei palvelimen organisaatiossa",
  } as Record<string, string>,
  appChanged: (name: string) =>
    `Palvelimen ${name}-sovellus on vaihtunut, eikä aiempi kirjautumisesi kelpaa uudelle sovellukselle. Kirjaudu uudelleen; synkronoitavat kansiot säilyvät.`,
  tenantChanged: (name: string) =>
    `Palvelimen ${name}-asetuksissa on nyt organisaatio, joka ei hyväksynyt aiempaa kirjautumistasi (se on voinut vanhentua tai vaatia uuden hyväksynnän). Kirjaudu uudelleen; synkronoitavat kansiot säilyvät.`,
  outsideTenant: (name: string) =>
    `Tämä tili ei kuulu organisaatioon, jonka ${name}-sovellusta palvelin käyttää, joten uusi kirjautuminenkaan ei auta. Käytä organisaation tiliä tai kysy palvelimen ylläpitäjältä.`,
  notChosenHelp:
    "Kansioita ei ole valittu, joten tiedostoja ei kopioitu. Voit valita ne kirjautumalla uudelleen.",
  deleteLimitHelp:
    "Synkronointi olisi poistanut yli puolet tiedostoista, joten se pysäytettiin eikä mitään poistettu. Jos poistit tiedostot tarkoituksella, pyydä ylläpitäjää hyväksymään poistot.",
  resyncHelp:
    "Edellisen synkronoinnin tiedot puuttuvat, joten synkronointi ei jatka omin päin. Tiedostot säilyvät molemmissa paikoissa. Pyydä ylläpitäjää tarkistamaan tilanne.",
  batch: "Nykyinen erä:",
  inventory: "Lasketaan valittujen tiedostojen kokoa ja tarkistetaan tila",
  preparing: "Luetaan tiedostoluetteloa",
  copying: "Kopioidaan tiedostoja",
  elapsed: (time: string) => `${time} kulunut`,
  files: (done: number, total: number) => `${done} / ${total} tiedostoa`,
  checking: "Tarkistetaan…",
  notInUse: "Ei käytössä",
  syncingNow: "Synkronoidaan nyt",
  syncingAlways: "Synkronoi jatkuvasti",

  signInAgain: "Kirjaudu uudelleen",
  changeLevel: "Vaihda taso…",
  check: "Tarkista",
  remove: "Poista…",
  appCredentialsMissing: (name: string) =>
    `Palvelimen ${name}-sovellusasetukset puuttuvat tai eivät enää kelpaa, joten agentit eivät nyt pääse tähän tiliin eikä synkronointi etene. Kirjautumisesi on tallessa. Pyydä palvelimen ylläpitäjää asettamaan tunnukset (Asetukset › Palvelimen ylläpito › Palvelinintegraatiot); sen jälkeen tili jatkaa.`,
  toolMissing: (name: string) =>
    `${name} ei ole käytettävissä tällä palvelimella, koska työkalu puuttuu. Kirjautumisesi on tallessa; tili jatkaa, kun ylläpitäjä on korjannut asennuksen.`,
  stopSync: "Keskeytä synkronointi",
  initialHelp:
    "Kirjaudu uudelleen ja valitse synkronointi, niin ensimmäinen synkronointi tehdään loppuun. Jo kopioidut tiedostot säilyvät.",
  quotaHelp:
    "Mitään ei kopioitu. Kirjaudu uudelleen ja valitse vähemmän kansioita, tai vapauta tilaa tai pyydä ylläpitäjältä lisää ja yritä uudelleen.",
  quotaNeeded: (needed: string, free: string) =>
    `Valitut tiedostot eivät mahdu tilaasi: tarvitaan ${needed}, vapaana ${free}`,
  retryHelp:
    "Kirjaudu uudelleen ja yritä synkronointia uudelleen. Jo kopioidut tiedostot säilyvät.",
  synced: "Synkronoitu",
  notSynced: "Ei vielä synkronoitu",
  checkedAt: (time: string) => `Tarkistettu klo ${time}`,
  newPassword: "Anna uusi salasana",
  appleWhy:
    "Apple mitätöi sovellussalasanat, kun Apple-tilin salasana vaihdetaan. Yksi uusi salasana korjaa kaikki palvelut.",
  notConnected: (services: string) => `${services} ei ole yhdistetty.`,
  addService: "Lisää palvelu…",
  skillBlocked:
    "Kotihakemistossasi on oma taito ~/.agents/skills/personal-data, joten agenttien tietokarttaa ei kirjoitettu sen päälle. Agentit eivät näe yhdistettyjä tilejä ennen kuin siirrät oman taitosi muualle.",
  skillFailed:
    "Agenttien tietokarttaa (~/.agents/skills/personal-data) ei saatu ajan tasalle. Se korjautuu, kun lisäät tai poistat tilin.",

  waitingAdmin: "Odottaa palvelimen ylläpitäjän sovellusasetuksia",
  unavailableHere: "Ei käytettävissä tällä palvelimella",
  connect: "Yhdistä…",
  intro:
    "Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia ja kalentereita.",
  skillWaits:
    "Agenttien tietokarttaa (~/.agents/skills/personal-data) ei päivitetä, ennen kuin kaikkien palvelujen tilit voidaan lukea.",
  connected: "Yhdistetyt tilit",
  unreadable: (gen: string, directory?: string) =>
    `${gen} tilejä ei voitu lukea turvallisesti, joten niitä ei näytetä. Tilit eivät kadonneet. Tarkista, ettei ${directory ? `kansio ${directory} tai mikään sen alla` : "mikään työkalun asetuskansio"} ole muiden kirjoitettavissa tai linkki.`,
  teaUnreadable:
    "tea-asetuksia ei voitu lukea turvallisesti, joten Gitea-yhteyksiä ei näytetä. Tarkista tiedoston ~/.config/tea/config.yml oikeudet ja muoto.",
  glabUnreadable:
    "glab-asetuksia ei voitu lukea turvallisesti, joten GitLab-yhteyksiä ei näytetä. Tarkista tiedoston ~/.config/glab-cli/config.yml oikeudet ja muoto.",
  addAnother: (provider: string, name: string) =>
    `Lisää toinen ${
      provider === "imap"
        ? "sähköpostitili"
        : provider === "apple"
          ? "Apple ID"
          : provider === "gitea"
            ? "Gitea-tili"
            : provider === "gitlab"
              ? "GitLab-palvelin"
              : provider === "trello"
                ? "Trello-yhteys"
                : `${name}-tili`
    }`,
  addAccount: "Lisää tili",
  otherServices: "Muut palvelut",
  othersNote:
    "Posti, kalenteri tai yhteystiedot muualta, esimerkiksi Fastmail tai Nextcloud.",
  foot: "Tila luetaan suoraan työkaluilta sinun käyttäjänäsi. Kirjautumistiedot ovat vain kotihakemistossasi; palvelin ei tallenna niitä eikä listaa liitoksiasi muualle. Uudet keskustelut näkevät liitoksen heti; käynnissä oleva keskustelu näkee sen, kun lataat sen uudelleen.",

  stepLogin: (name: string) => `Kirjaudu: ${name}`,
  stepFolders: (service: string) => `Valitse kansiot: ${service}`,
  steps: "Vaiheet",
  copyNamed: (label: string) => `Kopioi ${label}`,
  copied: "Kopioitu",
  copy: "Kopioi",
  badLoginAddress: "Kirjautumisosoite ei kelpaa. Peruuta ja yritä uudelleen.",
  signInWithCode: (ill: string) => `Kirjaudu ${ill} tällä koodilla`,
  oneCode:
    "Yksi koodi yhdistää OneDriven, SharePointin ja Outlookin tämän palvelimen työkaluihin.",
  codeTool: "Koodi kirjaa vain tämän palvelimen työkalun sinun tilillesi.",
  codeSpelled: (code: string) => `Koodi ${code}`,
  codeLabel: "koodi",
  open: (host: string) => `Avaa ${host}`,
  waitingCode: "Odotetaan, että hyväksyt kirjautumisen. Koodi vanhenee",
  onlyHere: (gen: string) =>
    `Syötä koodi vain tänne avaamallesi ${gen} sivulle. Jos joku muu pyytää sinua syöttämään koodin, älä tee sitä.`,
  cancel: "Peruuta",
  signInAt: (site: string) => `Kirjaudu: ${site}`,
  siteAsks: (site: string) =>
    `${site} kysyy, mille tilille ja mitkä luvat annat.`,
  pasteFirst: "Liitä ensin osoite, johon päädyit hyväksymisen jälkeen.",
  notThatAddress: (prefix: string) =>
    `Tämä ei ole se osoite. Liitä osoite, johon päädyit hyväksymisen jälkeen; se alkaa ${prefix}.`,
  pasteWhere: (site: string) => `Liitä osoite, johon ${site} lopuksi ohjasi`,
  approveTab: "Hyväksy luvat avautuneessa välilehdessä.",
  copyAddress: "Kopioi virhesivun osoiteriviltä koko osoite ja liitä se tähän.",
  returnAddress: "Paluuosoite",
  validFor: "Kirjautuminen on voimassa",
  openAgain: (site: string) => `Avaa ${site} uudelleen`,
  connectSubmit: "Yhdistä",
  errorPageLead:
    "Lopuksi selain näyttää virhesivun, jota ei voi avata. Se kuuluu asiaan.",
  errorPageBody: (site: string, prefix: ReactNode): ReactNode => (
    <>
      Kun olet hyväksynyt luvat, {site} ohjaa osoitteeseen, joka alkaa {prefix}.
      Älä sulje sitä välilehteä: sen osoite sisältää kirjautumisen. Kopioi
      osoite osoiteriviltä ja palaa tänne.
    </>
  ),
  about: (size: string) => `noin ${size}`,
  measuring: "Lasketaan kokoa…",
  sizeLater: "Koko lasketaan ennen kopiointia",

  whichFolders: (directory: ReactNode): ReactNode => (
    <>Mitkä kansiot synkronoidaan kansioon {directory}?</>
  ),
  foldersStay:
    "Kansiot pysyvät ajan tasalla jatkuvasti, myös kun selain on kiinni. Ne vievät tilaa kotihakemistosi kiintiöstä.",
  wholeOver: (
    name: string,
    estimated: boolean,
    size: string,
    free: string,
    choose: boolean,
    skip: boolean,
  ): ReactNode => (
    <>
      <b>
        {name} ei mahdu kotihakemistoosi{estimated ? " (arvio)" : ""}.
      </b>{" "}
      Se vie {estimated ? "noin " : ""}
      {size}, vapaana on {free}.{" "}
      {choose
        ? "Valitse alta vain kansiot, joita agentit tarvitsevat"
        : "Pyydä ylläpitäjältä lisää tilaa"}
      {skip ? ", tai jatka ilman tiedostoja." : "."}
    </>
  ),
  folders: "Kansiot",
  nothingChosen: "Mitään ei ole valittu.",
  free: (free: string) => `Vapaana ${free}.`,
  measuringChosen:
    "Valittujen kansioiden koko lasketaan, ja tilan riittävyys tarkistetaan ennen kuin mitään kopioidaan.",
  freeUnknown: "Vapaa tila ei ole vielä tiedossa.",
  over: (estimated: boolean, total: string, free: string): ReactNode => (
    <>
      <b>Ei mahdu{estimated ? " arvion mukaan" : ""}.</b> Valitut{" "}
      {estimated ? "noin " : ""}
      {total}, vapaana {free}.{" "}
      {estimated
        ? "Koko lasketaan tarkasti ennen kopiointia, mutta valitse mieluummin vain tarvitsemasi kansiot."
        : "Jätä jokin kansio pois tai pyydä ylläpitäjältä lisää tilaa."}
    </>
  ),
  chosen: (estimated: boolean, total: string, free: string, quota?: string) =>
    `Valittu ${estimated ? "noin " : ""}${total}. Kotihakemistossa on vapaana ${free}${quota ? ` / ${quota}` : ""}.`,
  skipFiles: "Jatka ilman tiedostoja",
  startSync: "Aloita synkronointi",
  close: "Sulje",
  restart: "Aloita alusta",
  quotaInsufficient: "Valitut tiedostot eivät mahdu kotihakemistosi kiintiöön.",
  quotaUnknown: "Kotihakemiston vapaata tilaa ei voitu tarkistaa.",
  nothingCopied: "Mitään ei kopioitu.",
  keptOthers:
    "Kirjautuminen säilyi, joten tilin muut palvelut toimivat jo. Voit sulkea tämän ja jatkaa ilman tiedostoja, tai aloittaa alusta ja valita vähemmän kansioita.",
  kept: "Kirjautuminen säilyi. Vapauta tilaa, tai aloita alusta ja valitse vähemmän kansioita.",
  moreSpace: "Lisää tilaa saat ylläpitäjältä.",
  consentLead: "Organisaatiosi vaatii ylläpitäjän luvan.",
  consentBody:
    "Käyttäjät eivät voi itse sallia sovelluksille pääsyä postiin, kalenteriin tai tiedostoihin. Ylläpitäjän pitää hyväksyä tämän palvelimen sovellus kerran koko organisaatiolle.",
  sendLink:
    "Lähetä tämä linkki organisaatiosi ylläpitäjälle. Hän näkee, mitä sovellus pyytää, ennen kuin hyväksyy.",
  consentLink: "ylläpitäjän hyväksyntälinkki",
  afterConsent:
    "Kun lupa on annettu, kirjaudu uudelleen. Mitään ei tallennettu.",
  nothingGrantedLead: "Kirjautuminen ei myöntänyt yhtään käytettävää oikeutta.",
  nothingGrantedBody: (site: string) =>
    `${site} ei myöntänyt Habitatille mitään, mitä agentit voisivat käyttää, joten tiliä ei yhdistetty. Mitään ei tallennettu.`,
  grantOne:
    "Kirjaudu uudelleen ja myönnä vähintään yksi palvelu, tai pyydä organisaatiosi ylläpitäjää sallimaan sovelluksen oikeudet.",
  levelNotChanged: "Tasoa ei vaihdettu.",
  finalSyncFailed: (google: boolean) =>
    `Ennen vaihtoa tiedostot piti synkronoida vielä kerran molempiin suuntiin, mutta se ei onnistunut. Tili toimii entisellä tasolla${google ? ", eikä vanhaa kirjautumista peruttu." : ", ja uusi kirjautuminen peruttiin."}`,

  checkFiles:
    "Katso tiedostojen tila Tiedot agenteille -sivulta ja yritä uudelleen, kun synkronointi toimii.",
  alreadyConnected: (): ReactNode => (
    <>
      <b>Tili on jo yhdistetty toisella tasolla.</b> Mitään ei muutettu. Vaihda
      sen taso tilin kortista kohdasta Vaihda taso…, jotta vanha kirjautuminen
      perutaan ensin.
    </>
  ),
  revokeFailed: (gen: string): ReactNode => (
    <>
      <b>Tasoa ei vaihdettu.</b> Vanhaa kirjautumista ei saatu perutuksi {gen}{" "}
      päässä, joten sen oikeudet olisivat jääneet voimaan. Tili toimii entisellä
      tasolla, eikä uutta kirjautumista aloitettu.
    </>
  ),
  tryLater: "Yritä hetken kuluttua uudelleen.",
  deviceBlocked: (site: string): ReactNode => (
    <>
      <b>Organisaatiosi estää kirjautumisen laitekoodilla.</b> {site} pysäytti
      kirjautumisen organisaation pääsysäännön takia. Tältä palvelimelta ei ole
      toista reittiä.
    </>
  ),
  allowDevice:
    "Organisaatiosi ylläpitäjä voi sallia laitekoodikirjautumisen tälle sovellukselle.",
  expired:
    "Kirjautuminen vanheni ennen kuin se valmistui. Mitään ei yhdistetty.",
  redirectRejected: (site: string) =>
    `${site} ei hyväksynyt liitettyä osoitetta. Se voi olla vanhan kirjautumisen osoite. Mitään ei yhdistetty.`,
  accountMismatch: (address: string): ReactNode => (
    <>
      Kirjauduit eri tilille kuin <b>{address}</b>. Tiliä ei muutettu. Valitse
      kirjautuessasi sama tili.
    </>
  ),
  cancelled: "Kirjautuminen peruttiin. Mitään ei yhdistetty.",
  failed: "Kirjautuminen ei onnistunut. Mitään ei yhdistetty.",
  newAppPassword: (address: string): ReactNode => (
    <>
      Anna tilin <b>{address}</b> uusi sovellussalasana. Vanha jää voimaan, jos
      palvelin ei hyväksy uutta.
    </>
  ),

  passwordIntro: (dav: boolean) =>
    `Luo postipalvelusi asetuksissa sovellussalasana tätä palvelinta varten ja kirjoita se tähän palvelimen tietojen kanssa. Salasana tallentuu vain kotihakemistosi ${dav ? "curl-asetuksiin" : "himalaya-asetuksiin"}.${dav ? " Anna palveluntarjoajan CalDAV- tai CardDAV-osoite, iCloudissa https://caldav.icloud.com tai https://contacts.icloud.com. Liitä kalenteri ja yhteystiedot erikseen." : " SMTP käyttää samaa käyttäjätunnusta ja sovellussalasanaa kuin IMAP. Jätä SMTP tyhjäksi, jos haluat vain luonnokset."}`,
  email: "Sähköpostiosoite",
  davAddress: "DAV-osoite (HTTPS)",
  imapServer: "IMAP-palvelin",
  port: "Portti",
  security: "Suojaus",
  smtpServer: "SMTP-palvelin (valinnainen)",
  smtpPort: "SMTP-portti",
  smtpSecurity: "SMTP-suojaus",
  username: "Käyttäjätunnus",
  changePassword: "Vaihda salasana",
  appPassword: "Sovellussalasana",
  googleNoDrafts:
    "Google ei tarjoa tätä tasoa. Gmailin luonnosoikeus antaa aina myös lähetysoikeuden, joten pelkkiä luonnoksia ei voi myöntää.",
  notOffered: (site: string) => `${site} ei tarjoa tätä tasoa.`,
  level: "Taso",
  levelNeedsApp: (name: string) =>
    `Ei käytössä tällä palvelimella. Taso vaatii palvelimelle oman ${name}-sovelluksen, jonka palvelimen ylläpitäjä lisää (Asetukset › Palvelimen ylläpito › Palvelinintegraatiot).`,
  signInAgainAt: (gen: string) =>
    `Kirjaudut uudelleen ${gen} sivulla. Uusi kirjautuminen korvaa vanhan.`,
  dropboxRevokes:
    "Habitat peruu vanhan kirjautumisen Dropboxin päässä, joten laajemmat oikeudet eivät jää voimaan.",
  googleRevokes:
    "Habitat peruu vanhan kirjautumisen Googlessa ennen kuin kirjaudut uudelleen, koska Google peruu kerralla kaikki Habitatin kirjautumiset. Jos keskeytät kirjautumisen, tili jää kirjautumatta, kunnes kirjaudut uudelleen.",
  oldRemoved: (site: string, gen: string) =>
    `Vanha kirjautuminen poistetaan kotihakemistostasi. ${site} ei anna perua yksittäistä kirjautumista, joten jos epäilet sen päätyneen muualle, kirjaudu ulos kaikista istunnoista ${gen} tiliasetuksista.`,
  finalSync: (name: string) =>
    `Ennen vaihtoa Habitat synkronoi ${name}-kansion vielä kerran molempiin suuntiin, joten jo tehdyt muutokset ehtivät palveluun. Jos se ei onnistu, mitään ei vaihdeta.`,
  toAppFolder:
    "Sovelluskansio synkronoituu omaan kansioonsa kotihakemistossasi. Nykyinen Dropbox-kansio jää paikalleen, mutta se ei enää synkronoidu.",
  fromAppFolder:
    "Dropbox synkronoituu omaan kansioonsa kotihakemistossasi. Sovelluskansion kansio jää paikalleen, mutta se ei enää synkronoidu.",
  becomesMirror: (name: string) =>
    `${name} muuttuu peiliksi: muutokset eivät enää palaa palveluun. Valitset kansiot uudelleen kirjautumisen jälkeen.`,
  syncsAgain: (name: string) =>
    `${name} synkronoituu taas molempiin suuntiin. Valitset kansiot uudelleen kirjautumisen jälkeen.`,

  canSendMail: "lähettää postia",
  canCalendar: "muuttaa kalenteria ja lähettää kutsuja",
  canAppFolder: "muokata ja poistaa sovelluskansion tiedostoja",
  canFiles: "muokata, poistaa ja jakaa tiedostoja",
  agentsCan: (can: string[]) =>
    `Agentit voivat ${can.length > 1 ? `${can.slice(0, -1).join(", ")} ja ${can[can.length - 1]}` : can[0]} sinun nimissäsi.`,
  draftsWarning:
    "Agentit voivat järjestellä postia ja kirjoittaa luonnoksia, mutta eivät lähettää mitään. Ne voivat silti kertoa eteenpäin kaiken, minkä lukevat.",
  readWarning:
    "Agentit eivät voi lähettää tai muuttaa mitään, mutta ne voivat lukea kaiken, minkä tämä taso avaa, ja kertoa sen eteenpäin.",
  levelWarningRest: (site: string) =>
    `Liitetty viesti tai tiedosto voi sisältää ohjeita, joita agentti yrittää noudattaa. Agentit näkevät myös kirjautumistiedon, mutta sillä voi tehdä vain sen, minkä ${site} myönsi.`,
  howDevice: (gen: string) =>
    `Kirjaudut ${gen} sivulla lyhyellä koodilla. Työpaikan tilillä organisaation ylläpitäjän voi joutua hyväksymään sovelluksen ensin.`,
  howPaste: (site: string) =>
    `${site} avautuu uuteen välilehteen. Hyväksymisen jälkeen kopioit sen osoitteen, johon päädyit, takaisin tänne.`,
  howPassword:
    "Tarvitset postipalvelusi sovellussalasanan ja palvelimen nimen. Ne kirjoitetaan vain kotihakemistosi asetuksiin.",
  continueTo: (site?: string) => (site ? `Jatka: ${site}` : "Jatka"),
  whatMay: "Mitä agentit saavat tehdä tällä tilillä?",
  levelAsked: (gen: string, site: string) =>
    `Taso pyydetään ${gen} kirjautumisessa, joten ${site} itse valvoo sitä.`,
  agentsGet: "Agentit saavat käyttöönsä",
  pickFiles:
    "Lukeminen, muokkaus ja poistaminen; tiedostot synkronoidaan kotihakemistoosi.",
  pickMail: "Postin lukeminen ja luonnokset.",
  pickOther: "Lukeminen ja muokkaus.",
  titleLevel: (name: string) => `Vaihda taso: ${name}`,
  titleRelogin: (name: string) => `Kirjaudu uudelleen: ${name}`,
  titleConnect: (provider: string, name: string) =>
    `Yhdistä ${provider === "imap" ? "sähköpostitili" : `${name}-tili`}`,
  uncertain:
    "Yhteys palvelimeen katkesi, eikä tiedetä, tallentuiko muutos. Tarkista tilanne Integraatiot-sivulta ennen kuin yrität uudelleen.",
  reloggedIn: (address: string) =>
    `Kirjauduttu uudelleen. ${address} toimii taas.`,
  connectedTo: (address: string): ReactNode => (
    <>
      <b>Yhdistetty: {address}.</b> Uudet keskustelut näkevät sen heti.
    </>
  ),
  done: "Valmis",
  sitesUnavailable: (sites: string) =>
    `Seuraavia SharePoint-sivustoja tai Teams-kanavia ei voitu avata, joten ne jätettiin pois: ${sites}. Jos tarvitset niitä, pyydä käyttöoikeus organisaatiosi ylläpitäjältä.`,
  teamsLeftOut: {
    not_granted:
      "Teams-tiimien tiedostoja ei voitu hakea, koska organisaatiosi ei ole antanut sovellukselle oikeutta nähdä tiimiluetteloasi. Jos tarvitset niitä, pyydä ylläpitäjää lisäämään sovellukselle Teams-oikeudet.",
    refused:
      "Microsoft ei antanut tiimiluetteloasi, joten Teams-tiimien tiedostoja ei ole valittavana. Jos tarvitset niitä, pyydä apua organisaatiosi ylläpitäjältä.",
    channels_not_granted:
      "Tiimien tiedostot ovat valittavana, mutta yksityisten ja jaettujen kanavien omia tiedostoja ei, koska organisaatiosi ei ole antanut sovellukselle oikeutta nähdä kanavia. Jos tarvitset niitä, pyydä ylläpitäjää lisäämään sovellukselle Teams-oikeudet.",
    too_many:
      "Kaikki Teams-tiimisi eivät mahtuneet valittavaksi, joten osa jätettiin pois.",
  },
  teamsNotOffered: (teams: string) =>
    `Kaikki Teams-tiimisi eivät mahtuneet valittavaksi. Nämä tiimit jätettiin pois: ${teams}.`,
  initialSync:
    "Ensimmäinen synkronointi on käynnissä. Tämä voi kestää kauan, jos tiedostoja on paljon.",
  filesDiscovery: "Hyväksytty. Haetaan OneDrive- ja SharePoint-tietoja…",
  outlookFinishing:
    "Outlookin kirjautuminen hyväksyttiin. Viimeistellään yhteyttä…",
  finishing: "Viimeistellään kirjautumista ja haetaan valittavat pilvikansiot…",
  starting: "Käynnistetään kirjautumista…",
  closeAnytime:
    "Voit sulkea tämän ikkunan ja jatkaa työskentelyä. Synkronointi jatkuu taustalla. Näet etenemisen ja lopputuloksen asetusten Integraatiot-sivulla.",
  background: "Jatka taustalla",
  foldersContinue:
    "Jos valitsit pilvikansioita, niiden synkronointi jatkuu myös tämän sivun sulkemisen jälkeen.",
  lostTools: (services: string) =>
    `Agentit eivät enää pääse palveluihin ${services}.`,
  and: " ja ",
  lostSync: (ill: string) =>
    `Synkronointi pysähtyy, eivätkä muutokset enää kulje ${ill}.`,
  removeQuestion: (address: string) => `Poistetaanko ${address}?`,
  removeTitle: (name: string, address: string) =>
    `Poistetaanko ${name}-tili ${address}?`,
  signInRemoved: "Kirjautuminen poistetaan tältä palvelimelta.",
  appPasswordStays: (imap: boolean) =>
    `Sovellussalasana pysyy voimassa ${imap ? "postipalvelussasi" : "DAV-palvelussasi"}, kunnes poistat sen sieltä.`,
  grantStays: (name: string) =>
    `${name} muistaa antamasi luvan, kunnes perut sen ${name}-tilisi asetuksista.`,
  trashFolders: (dirs: string[]) =>
    `Siirrä myös ${dirs.length > 1 ? "kansiot" : "kansio"} ${dirs.join(", ")} roskakoriin.`,
  trashHint:
    " Voit palauttaa ne kohdasta Asetukset › Tallennustila. Muuten tiedostot jäävät kotihakemistoosi tavallisiksi tiedostoiksi.",
  removeConfirm: "Poista",
};

export const integrationsText = catalog(
  fi,
  {
    providers: {
      atlassian: {
        name: "Atlassian",
        site: "Atlassian",
        gen: "Atlassian",
        ill: "Atlassian",
      },
      trello: { name: "Trello", site: "Trello", gen: "Trello", ill: "Trello" },
      google: { name: "Google", site: "Google", gen: "Google", ill: "Google" },
      microsoft: {
        name: "Microsoft 365",
        site: "Microsoft",
        gen: "Microsoft",
        ill: "Microsoft 365",
      },
      imap: {
        name: "Email (IMAP)",
        site: "Mail server",
        gen: "mail server",
        ill: "the mail server",
      },
      caldav: {
        name: "Calendar (CalDAV)",
        site: "DAV server",
        gen: "DAV server",
        ill: "the DAV server",
      },
      carddav: {
        name: "Contacts (CardDAV)",
        site: "DAV server",
        gen: "DAV server",
        ill: "the DAV server",
      },
      dropbox: {
        name: "Dropbox",
        site: "Dropbox",
        gen: "Dropbox",
        ill: "Dropbox",
      },
      apple: {
        name: "Apple (iCloud)",
        site: "Apple",
        gen: "Apple",
        ill: "iCloud",
      },
      gitea: { name: "Gitea", site: "Gitea", gen: "Gitea", ill: "Gitea" },
      gitlab: { name: "GitLab", site: "GitLab", gen: "GitLab", ill: "GitLab" },
    },
    services: {
      atlassian: { jira: "Jira issues", confluence: "Confluence pages" },
      trello: { trello: "Trello boards and cards" },
      google: {
        mail: "Gmail",
        calendar: "Google Calendar",
        contacts: "Google Contacts",
        drive: "Google Drive",
      },
      microsoft: {
        mail: "Outlook mail",
        calendar: "Outlook calendar",
        contacts: "Contacts",
        onedrive: "OneDrive and SharePoint",
        sharepoint: "SharePoint",
      },
      imap: {
        mail: "Mail",
        calendar: "Calendar (CalDAV)",
        contacts: "Contacts (CardDAV)",
      },
      caldav: { calendar: "Calendar (CalDAV)" },
      carddav: { contacts: "Contacts (CardDAV)" },
      dropbox: { dropbox: "Dropbox" },
      apple: {
        mail: "iCloud Mail",
        calendar: "iCloud Calendar",
        contacts: "iCloud Contacts",
      },
      gitea: { git: "Git repositories as workspaces" },
      gitlab: { git: "gitlab.com or a company's own GitLab" },
    },
    cloudFolder:
      "A synchronized OneDrive or Dropbox folder passes files between your own computer and the agent. Share screenshots there, for example, or ask the agent to save email attachments you want on your own computer there. Synchronize the same folder on your own computer too.",
    notGranted: "Not granted. Agents cannot reach this.",
    drafts: "Reads, organizes and writes drafts. Cannot send.",
    readFiles:
      "Read only. The folder is a mirror: changes do not go back to the service, and the next synchronization writes over them.",
    readMail: "Read only. Cannot change or send anything.",
    readCalendar: "Read only. Cannot create events or send invitations.",
    readOnly: "Read only.",
    levels: {
      atlassian: {
        read: {
          name: "Read only",
          sum: "Request read and search permissions. Check the granted scopes after sign-in: Atlassian may ask for broader consent.",
        },
        full: {
          name: "Read and write",
          sum: "Request permission to read and edit Jira issues and Confluence pages. Your account and resource permissions still apply.",
        },
      },
      trello: {
        read: {
          name: "Read only",
          sum: "Request read permissions only. Pi asks but cannot limit the grant: Trello may grant more. Only an administrator can reliably block writes, in Atlassian's MCP settings. The connection shows the actual grant.",
        },
        full: {
          name: "Read and write",
          sum: "Request permission to read and edit boards, cards, Inbox and Planner, but not to manage the Workspace. Workspace and board permissions still apply.",
        },
      },
      microsoft: {
        full: {
          name: "Full",
          sum: "Agents can read, edit and send in your name.",
        },
        nosend: {
          name: "Everything but sending mail",
          sum: "Agents can read and edit everything and write mail drafts, but cannot send mail. A calendar change still sends invitations, and a file can be shared.",
        },
        drafts: {
          name: "Drafts, otherwise read only",
          sum: "Agents read and write mail drafts. Nothing leaves the account: no mail, calendar invitations or sharing links.",
        },
        read: {
          name: "Read only",
          sum: "Agents read mail, calendar, contacts and files, but change nothing.",
        },
      },
      google: {
        full: {
          name: "Full",
          sum: "Agents can read, edit and send in your name.",
        },
        drafts: { name: "Drafts, no sending", sum: "" },
        read: {
          name: "Read only",
          sum: "Agents read Gmail, calendar, contacts and Drive, but change nothing.",
        },
      },
      dropbox: {
        full: {
          name: "All of Dropbox",
          sum: "Agents can read, edit, delete and share all your files.",
        },
        app_folder: {
          name: "App folder only",
          sum: "Agents see only the app's own folder in Dropbox's Apps folder. The rest of your Dropbox is not visible to them at all.",
        },
        read: {
          name: "Read only",
          sum: "Agents read all your files, but do not change, delete or share them.",
        },
      },
    },
    appFolder:
      "The app's folder only, synchronized both ways. The rest of Dropbox is not visible.",
    syncBoth:
      "Synchronized to your home directory both ways. Agents can edit, delete and share.",
    mirror:
      "Mirror: files are copied to your home directory, but changes do not go back. A change made in the folder is written over on the next round.",
    mailFull: "Reads, organizes, writes drafts and sends.",
    calendarFull: "Reads and edits. An event with attendees sends invitations.",
    full: "Reads and edits.",
    custom: "Custom",
    without: (level, services) => `${level}, without: ${services}`,
    missingSend: (name) => `${name}: sending`,
    missingEdit: (name) => `${name}: editing`,
    readFolder: (folder) => (
      <>
        Read only. The folder {folder} is a mirror: changes do not go back to
        the service, and the next synchronization writes over them.
      </>
    ),
    folder: (folder) => (
      <>The folder {folder}, which agents use with ordinary file tools</>
    ),
    himalaya: (command) => (
      <>Agents fetch and read mail and write drafts with {command}</>
    ),
    skill: "Agents use this through the personal-data skill",
    codeHosts: "Code hosts",
    dataForAgents: "Data for agents",
    limitsLead:
      "Agents can use everything the service granted for the accounts you connect here.",
    limitsBody:
      "They can send mail, change the calendar and edit or delete files in your name if the grant allows it, and a connected message or file can contain instructions the agent tries to follow. The granted permission is the service's own limit: it holds even if the agent errs or someone tries to steer it. It does not prevent this:",
    limitHome:
      "Agents run as your user, so they can also read the sign-in details in your home directory. If the information ends up elsewhere, it can do the same as the agent, no more.",
    limitTell:
      "An agent can pass on everything it may read. Read only does not prevent reading.",
    limitModes:
      "The agent tools' own “safe modes” are instructions, not limits. The limit is what the service granted.",
    narrowedOrg: (missing) => (
      <>
        <strong>Your organization has limited Habitat's permissions.</strong>{" "}
        Missing: {missing}. The connection works with the granted permissions.
        The limit is changed in the organization's Microsoft Entra
        administration, not here.
      </>
    ),
    narrowedSelf: (missing) => (
      <>
        <strong>Not granted when signing in:</strong> {missing}. Agents cannot
        reach them. Sign in again and grant them if you want. A Google Workspace
        administrator can also limit permissions.
      </>
    ),
    granted: (n) => `Granted permissions (${n})`,
    askedNotGranted: "asked, not granted",
    warnLead: "Agents can read and use everything you connect here.",
    warnBody:
      "They can send mail, change the calendar and edit or delete files in your name. A connected message or file can also contain instructions the agent tries to follow. Connect only what you want agents to use.",
    state: {
      ok: "Works",
      syncing: "Synchronizing",
      sync_failed: "Synchronization failed",
      credentials_rejected: "Username or password not valid",
      login_expired: "Sign-in expired",
      unreachable: "The server cannot be reached",
      sync_restarting: "Synchronization stopped, restarting",
      quota_full: "Quota full, synchronization stopped",
      unknown: "The state could not be found out",
      pending_first_sync: "Checked after the first sync",
    },
    failure: {
      quota_insufficient: "The chosen files do not fit in the quota",
      quota_unavailable: "Free space could not be checked",
      initial_sync_incomplete: "The first synchronization was left unfinished",
      not_chosen: "Not synchronized",
      initial_sync_resume_failed: "Continuing the first synchronization failed",
      delete_limit: "Stopped: too many deletions at once",
      all_changed: "Every file changed at once, checking and continuing",
      needs_resync: "Stopped and does not continue by itself",
      remote_unreachable: "The service cannot be reached, trying again",
      pass_failed: "The latest synchronization failed, trying again",
      app_changed: "Sign in again",
      tenant_changed: "Sign in again",
      outside_tenant: "Not in the server's organization",
    },
    appChanged: (name) =>
      `The server's ${name} app has changed, and your earlier sign-in is not valid for the new app. Sign in again; the synchronized folders stay.`,
    tenantChanged: (name) =>
      `The server's ${name} settings now have an organization that did not accept your earlier sign-in (it may have expired or need a new approval). Sign in again; the synchronized folders stay.`,
    outsideTenant: (name) =>
      `This account does not belong to the organization whose ${name} app the server uses, so signing in again does not help either. Use the organization's account or ask the server's administrator.`,
    notChosenHelp:
      "No folders are chosen, so no files were copied. You can choose them by signing in again.",
    deleteLimitHelp:
      "The synchronization would have deleted over half of the files, so it was stopped and nothing was deleted. If you deleted the files on purpose, ask the administrator to approve the deletions.",
    resyncHelp:
      "The previous synchronization's records are missing, so the synchronization does not continue on its own. The files stay in both places. Ask the administrator to check the situation.",
    batch: "Current batch:",
    inventory: "Counting the size of the chosen files and checking the space",
    preparing: "Reading the file list",
    copying: "Copying files",
    elapsed: (time) => `${time} elapsed`,
    files: (done, total) => `${done} / ${total} files`,
    checking: "Checking…",
    notInUse: "Not in use",
    syncingNow: "Synchronizing now",
    syncingAlways: "Synchronizes continuously",

    signInAgain: "Sign in again",
    changeLevel: "Change level…",
    check: "Check",
    remove: "Remove…",
    appCredentialsMissing: (name) =>
      `The server's ${name} app settings are missing or no longer valid, so agents cannot reach this account now and synchronization does not proceed. Your sign-in is kept. Ask the server's administrator to set the credentials (Settings › Server administration › Server integrations); after that the account continues.`,
    toolMissing: (name) =>
      `${name} is not available on this server because the tool is missing. Your sign-in is kept; the account continues once the administrator has fixed the installation.`,
    stopSync: "Stop synchronization",
    initialHelp:
      "Sign in again and choose synchronization, and the first synchronization is completed. Files already copied stay.",
    quotaHelp:
      "Nothing was copied. Sign in again and choose fewer folders, or free some space or ask the administrator for more and try again.",
    quotaNeeded: (needed, free) =>
      `The chosen files do not fit in your space: ${needed} needed, ${free} free`,
    retryHelp:
      "Sign in again and try the synchronization again. Files already copied stay.",
    synced: "Synchronized",
    notSynced: "Not synchronized yet",
    checkedAt: (time) => `Checked at ${time}`,
    newPassword: "Give a new password",
    appleWhy:
      "Apple invalidates app-specific passwords when the Apple account's password is changed. One new password fixes all services.",
    notConnected: (services) => `${services} not connected.`,
    addService: "Add service…",
    skillBlocked:
      "Your home directory has its own skill ~/.agents/skills/personal-data, so the agents' data map was not written over it. Agents do not see the connected accounts until you move your own skill elsewhere.",
    skillFailed:
      "The agents' data map (~/.agents/skills/personal-data) could not be brought up to date. It is fixed when you add or remove an account.",

    waitingAdmin: "Waiting for the server administrator's app settings",
    unavailableHere: "Not available on this server",
    connect: "Connect…",
    intro:
      "Connect your accounts on other services, and your agents can use their files, mail and calendars.",
    skillWaits:
      "The agents' data map (~/.agents/skills/personal-data) is not updated until the accounts of every service can be read.",
    connected: "Connected accounts",
    unreadable: (gen, directory) =>
      `${gen} accounts could not be read safely, so they are not shown. The accounts are not lost. Check that ${directory ? `the folder ${directory} and nothing under it` : "no settings folder of the tool"} is writable by others or a link.`,
    teaUnreadable:
      "tea's settings could not be read safely, so Gitea connections are not shown. Check the permissions and format of the file ~/.config/tea/config.yml.",
    glabUnreadable:
      "glab's settings could not be read safely, so GitLab connections are not shown. Check the permissions and format of the file ~/.config/glab-cli/config.yml.",
    addAnother: (provider, name) =>
      `Add another ${
        provider === "imap"
          ? "email account"
          : provider === "apple"
            ? "Apple ID"
            : provider === "gitea"
              ? "Gitea account"
              : provider === "gitlab"
                ? "GitLab server"
                : provider === "trello"
                  ? "Trello connection"
                  : `${name} account`
      }`,
    addAccount: "Add account",
    otherServices: "Other services",
    othersNote:
      "Mail, calendar or contacts from elsewhere, for example Fastmail or Nextcloud.",
    foot: "The state is read straight from the tools as your user. The sign-in details are only in your home directory; the server does not store them or list your connections anywhere else. New conversations see a connection at once; a running conversation sees it when you reload it.",

    stepLogin: (name) => `Sign in: ${name}`,
    stepFolders: (service) => `Choose folders: ${service}`,
    steps: "Steps",
    copyNamed: (label) => `Copy ${label}`,
    copied: "Copied",
    copy: "Copy",
    badLoginAddress: "The sign-in address is not valid. Cancel and try again.",
    signInWithCode: (ill) => `Sign in to ${ill} with this code`,
    oneCode:
      "One code connects OneDrive, SharePoint and Outlook to this server's tools.",
    codeTool: "The code signs only this server's tool in to your account.",
    codeSpelled: (code) => `Code ${code}`,
    codeLabel: "code",
    open: (host) => `Open ${host}`,
    waitingCode: "Waiting for you to approve the sign-in. The code expires in",
    onlyHere: (gen) =>
      `Enter the code only on the ${gen} page you opened from here. If someone else asks you to enter the code, do not do it.`,
    cancel: "Cancel",
    signInAt: (site) => `Sign in: ${site}`,
    siteAsks: (site) =>
      `${site} asks which account and which permissions you give.`,
    pasteFirst: "First paste the address you ended up at after approving.",
    notThatAddress: (prefix) =>
      `This is not that address. Paste the address you ended up at after approving; it starts ${prefix}.`,
    pasteWhere: (site) => `Paste the address ${site} finally sent you to`,
    approveTab: "Approve the permissions in the tab that opened.",
    copyAddress:
      "Copy the whole address from the error page's address bar and paste it here.",
    returnAddress: "Return address",
    validFor: "The sign-in is valid for",
    openAgain: (site) => `Open ${site} again`,
    connectSubmit: "Connect",
    errorPageLead:
      "Finally the browser shows an error page that cannot be opened. That is expected.",
    errorPageBody: (site, prefix) => (
      <>
        Once you have approved the permissions, {site} sends you to an address
        that starts {prefix}. Do not close that tab: its address holds the
        sign-in. Copy the address from the address bar and come back here.
      </>
    ),
    about: (size) => `about ${size}`,
    measuring: "Measuring the size…",
    sizeLater: "The size is measured before copying",

    whichFolders: (directory) => (
      <>Which folders are synchronized into the folder {directory}?</>
    ),
    foldersStay:
      "The folders stay up to date continuously, also while the browser is closed. They take space from your home directory's quota.",
    wholeOver: (name, estimated, size, free, choose, skip) => (
      <>
        <b>
          {name} does not fit in your home directory
          {estimated ? " (estimate)" : ""}.
        </b>{" "}
        It takes {estimated ? "about " : ""}
        {size}, and {free} is free.{" "}
        {choose
          ? "Choose below only the folders the agents need"
          : "Ask the administrator for more space"}
        {skip ? ", or continue without files." : "."}
      </>
    ),
    folders: "Folders",
    nothingChosen: "Nothing is chosen.",
    free: (free) => `${free} free.`,
    measuringChosen:
      "The size of the chosen folders is being measured, and whether the space is enough is checked before anything is copied.",
    freeUnknown: "The free space is not known yet.",
    over: (estimated, total, free) => (
      <>
        <b>Does not fit{estimated ? " by the estimate" : ""}.</b> Chosen{" "}
        {estimated ? "about " : ""}
        {total}, free {free}.{" "}
        {estimated
          ? "The size is measured exactly before copying, but rather choose only the folders you need."
          : "Leave a folder out or ask the administrator for more space."}
      </>
    ),
    chosen: (estimated, total, free, quota) =>
      `Chosen ${estimated ? "about " : ""}${total}. The home directory has ${free}${quota ? ` / ${quota}` : ""} free.`,
    skipFiles: "Continue without files",
    startSync: "Start synchronization",
    close: "Close",
    restart: "Start over",
    quotaInsufficient:
      "The chosen files do not fit in your home directory's quota.",
    quotaUnknown: "The home directory's free space could not be checked.",
    nothingCopied: "Nothing was copied.",
    keptOthers:
      "The sign-in was kept, so the account's other services already work. You can close this and continue without files, or start over and choose fewer folders.",
    kept: "The sign-in was kept. Free some space, or start over and choose fewer folders.",
    moreSpace: "The administrator can give you more space.",
    consentLead: "Your organization requires an administrator's consent.",
    consentBody:
      "Users cannot themselves allow apps access to mail, calendar or files. An administrator has to approve this server's app once for the whole organization.",
    sendLink:
      "Send this link to your organization's administrator. They see what the app asks for before approving.",
    consentLink: "the administrator's approval link",
    afterConsent: "Once consent is given, sign in again. Nothing was saved.",
    nothingGrantedLead: "The sign-in granted no usable permission.",
    nothingGrantedBody: (site) =>
      `${site} granted Habitat nothing the agents could use, so the account was not connected. Nothing was saved.`,
    grantOne:
      "Sign in again and grant at least one service, or ask your organization's administrator to allow the app's permissions.",
    levelNotChanged: "The level was not changed.",
    finalSyncFailed: (google) =>
      `Before the change the files had to be synchronized once more both ways, but that did not succeed. The account works at its previous level${google ? ", and the old sign-in was not revoked." : ", and the new sign-in was revoked."}`,

    checkFiles:
      "See the files' state on the Data for agents page and try again once synchronization works.",
    alreadyConnected: () => (
      <>
        <b>The account is already connected at another level.</b> Nothing was
        changed. Change its level from the account card's Change level…, so the
        old sign-in is revoked first.
      </>
    ),
    revokeFailed: (gen) => (
      <>
        <b>The level was not changed.</b> The old sign-in could not be revoked
        at {gen}, so its permissions would have stayed valid. The account works
        at its previous level, and no new sign-in was started.
      </>
    ),
    tryLater: "Try again in a moment.",
    deviceBlocked: (site) => (
      <>
        <b>Your organization blocks signing in with a device code.</b> {site}{" "}
        stopped the sign-in because of the organization's access rule. There is
        no other route from this server.
      </>
    ),
    allowDevice:
      "Your organization's administrator can allow device code sign-in for this app.",
    expired: "The sign-in expired before it finished. Nothing was connected.",
    redirectRejected: (site) =>
      `${site} did not accept the pasted address. It may be an old sign-in's address. Nothing was connected.`,
    accountMismatch: (address) => (
      <>
        You signed in to a different account than <b>{address}</b>. The account
        was not changed. Choose the same account when signing in.
      </>
    ),
    cancelled: "The sign-in was canceled. Nothing was connected.",
    failed: "The sign-in did not succeed. Nothing was connected.",
    newAppPassword: (address) => (
      <>
        Give a new app-specific password for the account <b>{address}</b>. The
        old one stays valid if the server does not accept the new one.
      </>
    ),

    passwordIntro: (dav) =>
      `Create an app-specific password for this server in your mail service's settings and enter it here with the server's details. The password is saved only in your home directory's ${dav ? "curl settings" : "himalaya settings"}.${dav ? " Give the provider's CalDAV or CardDAV address, in iCloud https://caldav.icloud.com or https://contacts.icloud.com. Connect the calendar and contacts separately." : " SMTP uses the same username and app-specific password as IMAP. Leave SMTP empty if you want drafts only."}`,
    email: "Email address",
    davAddress: "DAV address (HTTPS)",
    imapServer: "IMAP server",
    port: "Port",
    security: "Security",
    smtpServer: "SMTP server (optional)",
    smtpPort: "SMTP port",
    smtpSecurity: "SMTP security",
    username: "Username",
    changePassword: "Change password",
    appPassword: "App-specific password",
    googleNoDrafts:
      "Google does not offer this level. Gmail's drafts permission always gives the sending permission too, so drafts alone cannot be granted.",
    notOffered: (site) => `${site} does not offer this level.`,
    level: "Level",
    levelNeedsApp: (name) =>
      `Not in use on this server. The level needs the server's own ${name} app, which the server's administrator adds (Settings › Server administration › Server integrations).`,
    signInAgainAt: (gen) =>
      `You sign in again on the ${gen} page. The new sign-in replaces the old one.`,
    dropboxRevokes:
      "Habitat revokes the old sign-in at Dropbox, so wider permissions do not stay valid.",
    googleRevokes:
      "Habitat revokes the old sign-in at Google before you sign in again, because Google revokes all of Habitat's sign-ins at once. If you stop the sign-in, the account stays signed out until you sign in again.",
    oldRemoved: (site, gen) =>
      `The old sign-in is removed from your home directory. ${site} does not allow revoking a single sign-in, so if you suspect it ended up elsewhere, sign out of all sessions in your ${gen} account settings.`,
    finalSync: (name) =>
      `Before the change Habitat synchronizes the ${name} folder once more both ways, so changes already made reach the service. If that does not succeed, nothing is changed.`,
    toAppFolder:
      "The app folder synchronizes into its own folder in your home directory. The current Dropbox folder stays in place, but it no longer synchronizes.",
    fromAppFolder:
      "Dropbox synchronizes into its own folder in your home directory. The app folder's folder stays in place, but it no longer synchronizes.",
    becomesMirror: (name) =>
      `${name} becomes a mirror: changes no longer go back to the service. You choose the folders again after signing in.`,
    syncsAgain: (name) =>
      `${name} synchronizes both ways again. You choose the folders again after signing in.`,

    canSendMail: "send mail",
    canCalendar: "change the calendar and send invitations",
    canAppFolder: "edit and delete the app folder's files",
    canFiles: "edit, delete and share files",
    agentsCan: (can) =>
      `Agents can ${can.length > 1 ? `${can.slice(0, -1).join(", ")} and ${can[can.length - 1]}` : can[0]} in your name.`,
    draftsWarning:
      "Agents can organize mail and write drafts, but cannot send anything. They can still pass on everything they read.",
    readWarning:
      "Agents cannot send or change anything, but they can read everything this level opens and pass it on.",
    levelWarningRest: (site) =>
      `A connected message or file can contain instructions the agent tries to follow. Agents also see the sign-in details, but those let them do only what ${site} granted.`,
    howDevice: (gen) =>
      `You sign in on the ${gen} page with a short code. With a work account, the organization's administrator may have to approve the app first.`,
    howPaste: (site) =>
      `${site} opens in a new tab. After approving, you copy the address you ended up at back here.`,
    howPassword:
      "You need your mail service's app-specific password and the server's name. They are written only to your home directory's settings.",
    continueTo: (site) => (site ? `Continue: ${site}` : "Continue"),
    whatMay: "What may agents do with this account?",
    levelAsked: (gen, site) =>
      `The level is asked for in the ${gen} sign-in, so ${site} itself enforces it.`,
    agentsGet: "Agents get to use",
    pickFiles:
      "Reading, editing and deleting; the files are synchronized to your home directory.",
    pickMail: "Reading mail and drafts.",
    pickOther: "Reading and editing.",
    titleLevel: (name) => `Change level: ${name}`,
    titleRelogin: (name) => `Sign in again: ${name}`,
    titleConnect: (provider, name) =>
      `Connect ${provider === "imap" ? "an email account" : `a ${name} account`}`,
    uncertain:
      "The connection to the server broke, and it is not known whether the change was saved. Check the situation on the Integrations page before you try again.",
    reloggedIn: (address) => `Signed in again. ${address} works again.`,
    connectedTo: (address) => (
      <>
        <b>Connected: {address}.</b> New conversations see it at once.
      </>
    ),
    done: "Done",
    sitesUnavailable: (sites) =>
      `The following SharePoint sites or Teams channels could not be opened, so they were left out: ${sites}. If you need them, ask your organization's administrator for access.`,
    teamsLeftOut: {
      not_granted:
        "Teams files could not be fetched because your organization has not allowed the app to see your list of teams. If you need them, ask the administrator to add the Teams permissions to the app.",
      refused:
        "Microsoft did not return your list of teams, so no Teams files can be chosen. If you need them, ask your organization's administrator for help.",
      channels_not_granted:
        "Your teams' files can be chosen, but not the own files of private and shared channels, because your organization has not allowed the app to see channels. If you need them, ask the administrator to add the Teams permissions to the app.",
      too_many:
        "Not all of your teams fit in the choice, so some were left out.",
    },
    teamsNotOffered: (teams) =>
      `Not all of your teams fit in the choice. These teams were left out: ${teams}.`,
    initialSync:
      "The first synchronization is running. This can take long if there are many files.",
    filesDiscovery: "Approved. Fetching OneDrive and SharePoint details…",
    outlookFinishing:
      "The Outlook sign-in was approved. Finishing the connection…",
    finishing:
      "Finishing the sign-in and fetching the cloud folders to choose from…",
    starting: "Starting the sign-in…",
    closeAnytime:
      "You can close this window and keep working. The synchronization continues in the background. You see its progress and result on the Integrations page of Settings.",
    background: "Continue in the background",
    foldersContinue:
      "If you chose cloud folders, their synchronization continues after you close this page too.",
    lostTools: (services) => `Agents can no longer reach ${services}.`,
    and: " and ",
    lostSync: (ill) =>
      `Synchronization stops, and changes no longer reach ${ill}.`,
    removeQuestion: (address) => `Remove ${address}?`,
    removeTitle: (name, address) => `Remove the ${name} account ${address}?`,
    signInRemoved: "The sign-in is removed from this server.",
    appPasswordStays: (imap) =>
      `The app-specific password stays valid in your ${imap ? "mail service" : "DAV service"} until you remove it there.`,
    grantStays: (name) =>
      `${name} remembers the permission you gave until you revoke it in your ${name} account settings.`,
    trashFolders: (dirs) =>
      `Also move the ${dirs.length > 1 ? "folders" : "folder"} ${dirs.join(", ")} to the Trash.`,
    trashHint:
      " You can restore them under Settings › Storage. Otherwise the files stay in your home directory as ordinary files.",
    removeConfirm: "Remove",
  },
  {
    narrowedOrg: (missing) => (
      <>
        <strong>Your organisation has limited Habitat's permissions.</strong>{" "}
        Missing: {missing}. The connection works with the granted permissions.
        The limit is changed in the organisation's Microsoft Entra
        administration, not here.
      </>
    ),
    failure: { outside_tenant: "Not in the server's organisation" },
    drafts: "Reads, organises and writes drafts. Cannot send.",
    mailFull: "Reads, organises, writes drafts and sends.",
    draftsWarning:
      "Agents can organise mail and write drafts, but cannot send anything. They can still pass on everything they read.",
    tenantChanged: (name) =>
      `The server's ${name} settings now have an organisation that did not accept your earlier sign-in (it may have expired or need a new approval). Sign in again; the synchronized folders stay.`,
    outsideTenant: (name) =>
      `This account does not belong to the organisation whose ${name} app the server uses, so signing in again does not help either. Use the organisation's account or ask the server's administrator.`,
    consentLead: "Your organisation requires an administrator's consent.",
    consentBody:
      "Users cannot themselves allow apps access to mail, calendar or files. An administrator has to approve this server's app once for the whole organisation.",
    sendLink:
      "Send this link to your organisation's administrator. They see what the app asks for before approving.",
    grantOne:
      "Sign in again and grant at least one service, or ask your organisation's administrator to allow the app's permissions.",
    deviceBlocked: (site) => (
      <>
        <b>Your organisation blocks signing in with a device code.</b> {site}{" "}
        stopped the sign-in because of the organisation's access rule. There is
        no other route from this server.
      </>
    ),
    allowDevice:
      "Your organisation's administrator can allow device code sign-in for this app.",
    cancelled: "The sign-in was cancelled. Nothing was connected.",
    howDevice: (gen) =>
      `You sign in on the ${gen} page with a short code. With a work account, the organisation's administrator may have to approve the app first.`,
    sitesUnavailable: (sites) =>
      `The following SharePoint sites or Teams channels could not be opened, so they were left out: ${sites}. If you need them, ask your organisation's administrator for access.`,
    teamsLeftOut: {
      not_granted:
        "Teams files could not be fetched because your organisation has not allowed the app to see your list of teams. If you need them, ask the administrator to add the Teams permissions to the app.",
      refused:
        "Microsoft did not return your list of teams, so no Teams files can be chosen. If you need them, ask your organisation's administrator for help.",
      channels_not_granted:
        "Your teams' files can be chosen, but not the own files of private and shared channels, because your organisation has not allowed the app to see channels. If you need them, ask the administrator to add the Teams permissions to the app.",
      too_many:
        "Not all of your teams fit in the choice, so some were left out.",
    },
  },
);

```
