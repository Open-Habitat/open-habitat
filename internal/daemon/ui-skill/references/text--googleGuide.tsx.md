# text/googleGuide.tsx

Generated from web/src/text/googleGuide.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The administrator's Google guide (components/GoogleGuide.tsx): whose
// accounts may connect, and what each choice asks of Google Cloud. Google
// Cloud's menu, field and button names stay in English, as the console
// shows them. Google's own warning screen is named only by the English
// labels Google documents; its Finnish wording is not confirmed, and the
// text says so where it names it.
const em = (text: string) => <em>{text}</em>;
const fi = {
  audienceTitle: "Google: kenen tilit voivat yhdistää",
  stepAudience: "Kenen tilit",
  stepBrand: "Nimi ja tietosuoja",
  stepBrandOrg: "Sovelluksen nimi",
  stepPublish: "Julkaisu",
  stepWorkspace: "Työtilit",
  stepReady: "Kokeile",
  question: "Kenen Google-tilit voivat yhdistää tähän palvelimeen?",
  org: {
    name: "Vain organisaation tilit",
    body: "Vain organisaatiosi Google Workspacen tilit. Henkilökohtaiset @gmail.com-tilit ja muiden organisaatioiden tilit eivät pääse.",
    facts: [
      "Edellyttää Google Workspacea.",
      "Ei Googlen varoitusta eikä käyttäjärajaa.",
    ],
  },
  personal: {
    name: "Myös henkilökohtaiset tilit",
    body: "Mikä tahansa Google-tili, myös @gmail.com. Projekti ei tarvitse organisaatiota.",
    facts: [
      "Google varoittaa henkilöä ennen lupia, koska sovellusta ei ole vahvistettu.",
      "Enintään 100 uutta käyttäjää projektin koko elinaikana.",
      "Tarvitset julkisen tietosuojaselosteen ja oman verkkotunnuksen.",
      "Toisen organisaation työtili voi olla estetty sen ylläpitäjän päätöksellä.",
    ],
  },
  smallGroup:
    "Sopii pienelle, tunnetulle joukolle, kuten perheelle tai pienelle yritykselle, ei julkiselle palvelulle.",
  notStored:
    "Habitat ei tallenna valintaa eikä näe, mitä Googlessa on valittu. Valinta ohjaa vain tätä ohjetta.",
  chooseFirst: "Valitse ensin, kenen tilit voivat yhdistää.",
  existingNote:
    "Tunnukset on jo asetettu. Habitat ei näe, kumpi kohdeyleisö Googlessa on valittu, joten tarkista se:",
  keepConnections:
    "Ohje ei vaihda asiakasta eikä salaisuutta eikä katkaise yhteyksiä. Täysi ja Vain luku -taso säilyvät.",
  orgAlready:
    "Jos Audience-sivulla lukee Internal, mitään ei tarvitse muuttaa.",
  apisPersonal:
    "Valitse Google Cloud -projekti, jota käytät vain tälle palvelimelle, ja ota käyttöön:",
  ownProject:
    "Testipalvelimelle oma projekti: käyttäjäraja lasketaan projektikohtaisesti.",
  external:
    "External sallii kaikki Google-tilit. Google ei vaadi vahvistusta tällaiseen pieneen käyttöön, mutta näyttää varoituksen.",
  supportEmail: "<ylläpidon osoite>",
  supportNote:
    "Oman tilisi osoite tai ryhmä, jota hallitset. Henkilöt näkevät sen.",
  homepage: "https://<verkkotunnuksesi>/",
  privacy: "https://<verkkotunnuksesi>/tietosuoja",
  terms: "https://<verkkotunnuksesi>/ehdot",
  domain: "<verkkotunnuksesi>",
  domainNote:
    "Verkkotunnuksen on oltava sinun. Google varmistaa omistuksen Search Consolessa. localhost ei käy.",
  privacyNote:
    "Tietosuojaseloste tarvitaan, vaikka sovellusta ei lähetetä Googlen vahvistukseen. Kerro siinä, mitä agentit lukevat, mihin tieto tallentuu ja kenelle se välittyy, esimerkiksi kielimallin palveluntarjoajalle. Habitat ei tarkista tätä; vastuu on sinulla.",
  termsNote:
    "Googlen ohjeet ovat ristiriidassa siitä, ovatko käyttöehdot pakolliset. Anna ne.",
  previewTitle: "Näin henkilö näkee sovelluksen ennen lupia",
  previewNote:
    "Googlen englanninkielinen polku on Advanced › Go to … (unsafe). Suomenkielisen Googlen sanoja ja sitä, mikä nimi kohdassa … näkyy, ei ole varmistettu. Google ei näytä sovelluksen nimeä ja logoa, ennen kuin brändi on vahvistettu.",
  restricted:
    "gmail.modify ja drive ovat Googlen rajattuja oikeuksia, kalenteri ja yhteystiedot arkaluonteisia. Siksi varoitus ja käyttäjäraja koskevat tätä sovellusta. Suppeammat oikeudet eivät poista niitä.",
  makeExternal: (button: string): ReactNode => (
    <>Jos User type on Internal, valitse ensin {em(button)}.</>
  ),
  publishWhere: "Mitä Publishing status -kohdassa lukee?",
  testingWarn:
    "Testing-tilassa vain Test users -listalle lisätyt henkilöt (enintään 100) voivat yhdistää, ja yhteys vanhenee 7 päivässä.",
  publishNow: (button: string): ReactNode => (
    <>Valitse {em(button)} ja vahvista.</>
  ),
  productionOk:
    "Julkaistu. Tämä ei ole Googlen vahvistus: henkilöt näkevät yhä varoituksen.",
  capTitle: "Käyttäjäraja",
  cap: "100 uutta käyttäjää koko projektin elinaikana. Raja ei nollaudu, kun yhteys poistetaan tai asiakas vaihdetaan.",
  capWhere: "Täältä näet, montako on käytetty.",
  noVerification:
    "Vahvistusta (verification) ei tarvitse hakea tähän käyttöön.",
  publishInGoogle:
    "Julkaisu tehdään Googlessa. Tunnusten tallentaminen Habitatiin ei julkaise mitään.",
  workspaceLead:
    "Jos henkilön työtilin organisaatio estää sovelluksen, varoituksen ohittaminen ei auta. Organisaation ylläpitäjä voi luottaa sovellukseen. Lähetä hänelle:",
  workspaceMsgTitle: "Viesti ylläpitäjälle",
  workspaceMsg: (id: string) =>
    `Hei! Organisaatiosi henkilö haluaa yhdistää työtilinsä Open Habitat -palvelimeen, jota ylläpidän, mutta organisaatio estää sovelluksen. Jos hyväksyt sen, voit luottaa siihen näin:\n\nAdmin console › Security › Access and data control › API controls › Manage App Access › Configure new app\nHae tällä Client ID:llä: ${id}\nValitse organisaatio tai yksikkö › Trusted › Finish.\n\nMuutos voi kestää 24 tuntia.`,
  workspaceRole:
    "Vaatii Service Settings -oikeuden kyseisen organisaation Admin consolessa.",
  trustedNote:
    "Trusted koskee vain sitä organisaatiota. Se ei ole Googlen vahvistus eikä muuta mitään henkilökohtaisille tileille.",
  trustedWarning:
    "Todennäköisesti varoitus ei enää näy organisaation henkilöille, mutta Google ei sano sitä suoraan.",
  workspaceLater:
    "Tarvitset tätä vasta, jos joku kertoo, että Google estää yhdistämisen.",
  savedNote:
    "Tunnukset on tallennettu. Se ei vielä kerro, että kirjautuminen toimii.",
  readyPersonal: [
    "Yhdistä henkilökohtainen Gmail-tili kohdassa Asetukset › Tiedot agenteille › Google.",
    "Google varoittaa. Jatka: Advanced › Go to … (unsafe).",
    "Kokeile molempia tasoja, Täysi ja Vain luku. Ne käyttävät samaa asiakasta.",
    "Pyydä agenttia lukemaan viimeisin viesti.",
  ],
  readyOrg: [
    "Yhdistä organisaation tili kohdassa Asetukset › Tiedot agenteille › Google.",
    "Pyydä agenttia lukemaan viimeisin viesti.",
  ],
  migrationNote:
    "Googlen ohjeet eivät lupaa, että Internal-aikana annetut yhteydet säilyvät vaihdossa. Todennäköisesti ne toimivat, mutta tarkista.",
  readyExisting: [
    "Pyydä agenttia lukemaan Gmailia tilillä, joka oli yhdistetty ennen vaihtoa.",
    "Yhdistä uusi henkilökohtainen Gmail-tili. Google varoittaa; jatka Advanced-linkistä.",
    "Jos vanha yhteys ei toimi, henkilö yhdistää sen uudelleen kohdassa Tiedot agenteille. Älä luo uutta asiakasta äläkä katkaise kaikkia yhteyksiä.",
    "Testing-tilassa annetut yhteydet vanhenevat silti: yhdistä ne uudelleen julkaisun jälkeen.",
  ],
  unconfirmed: "varmistamatta",
  placeholder:
    "Kuvituskuva, ei Googlen oikea näkymä. Oikea kuvakaappaus tulee myöhemmin.",
  alt: {
    warning:
      "Kuvituskuva Googlen varoituksesta vahvistamattomasta sovelluksesta",
    warningOpen:
      "Kuvituskuva Googlen varoituksesta Advanced-osion ollessa auki",
    audience: "Kuvituskuva Google Auth platformin Audience-sivusta",
  },
  copied: "Kopioitu",
  done: "Valmis",
  audienceMenu: "Kenen tilit…",
};

export const googleGuideText = catalog(
  fi,
  {
    audienceTitle: "Google: whose accounts can connect",
    stepAudience: "Whose accounts",
    stepBrand: "Name and privacy",
    stepBrandOrg: "App name",
    stepPublish: "Publishing",
    stepWorkspace: "Work accounts",
    stepReady: "Try it",
    question: "Whose Google accounts can connect to this server?",
    org: {
      name: "Organization accounts only",
      body: "Only your organization's Google Workspace accounts. Personal @gmail.com accounts and other organizations' accounts cannot connect.",
      facts: [
        "Requires Google Workspace.",
        "No Google warning and no user cap.",
      ],
    },
    personal: {
      name: "Personal accounts too",
      body: "Any Google account, including @gmail.com. The project needs no organization.",
      facts: [
        "Google warns the person before the permissions, because the app is not verified.",
        "At most 100 new users over the project's whole lifetime.",
        "You need a public privacy policy and a domain of your own.",
        "Another organization's work account may be blocked by its administrator.",
      ],
    },
    smallGroup:
      "Suits a small, known group such as a family or a small company, not a public service.",
    notStored:
      "Habitat does not store the choice and cannot see what is chosen in Google. The choice only steers this guide.",
    chooseFirst: "First choose whose accounts can connect.",
    existingNote:
      "Credentials are already set. Habitat cannot see which audience is chosen in Google, so check it:",
    keepConnections:
      "The guide does not change the client or the secret and breaks no connections. The Full and Read only levels stay.",
    orgAlready: "If the Audience page says Internal, nothing needs to change.",
    apisPersonal:
      "Choose a Google Cloud project you use only for this server and enable:",
    ownProject:
      "A separate project for a test server: the user cap is counted per project.",
    external:
      "External allows any Google account. Google does not require verification for small use like this, but shows a warning.",
    supportEmail: "<administration address>",
    supportNote:
      "Your own account's address or a group you manage. People see it.",
    homepage: "https://<your-domain>/",
    privacy: "https://<your-domain>/privacy",
    terms: "https://<your-domain>/terms",
    domain: "<your-domain>",
    domainNote:
      "The domain must be yours. Google checks ownership in Search Console. localhost does not do.",
    privacyNote:
      "A privacy policy is needed even if the app is never sent for Google's verification. Say what agents read, where data is stored and to whom it passes, such as a language-model provider. Habitat does not check this; it is your responsibility.",
    termsNote:
      "Google's guides disagree on whether terms of service are required. Give them.",
    previewTitle: "What the person sees before the permissions",
    previewNote:
      "Google's English path is Advanced › Go to … (unsafe). The wording in other languages, and which name appears at …, are not confirmed. Google shows no app name or logo until the brand is verified.",
    restricted:
      "gmail.modify and drive are Google's restricted scopes, calendar and contacts sensitive ones. That is why the warning and the cap apply to this app. Narrower scopes do not remove them.",
    makeExternal: (button) => (
      <>If User type says Internal, first choose {em(button)}.</>
    ),
    publishWhere: "What does Publishing status say?",
    testingWarn:
      "In Testing, only people added to Test users (at most 100) can connect, and connections expire in 7 days.",
    publishNow: (button) => <>Choose {em(button)} and confirm.</>,
    productionOk:
      "Published. This is not Google's verification: people still see the warning.",
    capTitle: "User cap",
    cap: "100 new users over the project's whole lifetime. Removing a connection or replacing the client does not reset it.",
    capWhere: "Shows how many are used.",
    noVerification: "You need not apply for verification for this use.",
    publishInGoogle:
      "Publishing happens in Google. Saving credentials in Habitat publishes nothing.",
    workspaceLead:
      "If a person's work organization blocks the app, passing the warning does not help. The organization's administrator can trust the app. Send them:",
    workspaceMsgTitle: "Message to the administrator",
    workspaceMsg: (id) =>
      `Hi! A person in your organization wants to connect their work account to an Open Habitat server I run, but the organization blocks the app. If you approve, you can trust it like this:\n\nAdmin console › Security › Access and data control › API controls › Manage App Access › Configure new app\nSearch with this Client ID: ${id}\nChoose the organization or unit › Trusted › Finish.\n\nThe change can take 24 hours.`,
    workspaceRole:
      "Needs the Service Settings privilege in that organization's Admin console.",
    trustedNote:
      "Trusted applies to that organization only. It is not Google's verification and changes nothing for personal accounts.",
    trustedWarning:
      "Probably the warning no longer shows for that organization's people, but Google does not say so directly.",
    workspaceLater:
      "You need this only if someone says Google blocks connecting.",
    savedNote:
      "Credentials are saved. That does not yet tell that sign-in works.",
    readyPersonal: [
      "Connect a personal Gmail account in Settings › Data for agents › Google.",
      "Google warns. Continue: Advanced › Go to … (unsafe).",
      "Try both levels, Full and Read only. They use the same client.",
      "Ask an agent to read the latest message.",
    ],
    readyOrg: [
      "Connect an organization account in Settings › Data for agents › Google.",
      "Ask an agent to read the latest message.",
    ],
    migrationNote:
      "Google's guides do not promise that connections given while Internal survive the change. They probably work, but check.",
    readyExisting: [
      "Ask an agent to read Gmail on an account connected before the change.",
      "Connect a new personal Gmail account. Google warns; continue through Advanced.",
      "If an old connection fails, the person reconnects it in Data for agents. Do not create a new client or break every connection.",
      "Connections given in Testing still expire: reconnect them after publishing.",
    ],
    unconfirmed: "unconfirmed",
    placeholder:
      "Illustration, not Google's real screen. A real screenshot comes later.",
    alt: {
      warning: "Illustration of Google's unverified-app warning",
      warningOpen: "Illustration of Google's warning with Advanced open",
      audience: "Illustration of the Google Auth platform Audience page",
    },
    copied: "Copied",
    done: "Done",
    audienceMenu: "Whose accounts…",
  },
  {
    org: {
      name: "Organisation accounts only",
      body: "Only your organisation's Google Workspace accounts. Personal @gmail.com accounts and other organisations' accounts cannot connect.",
      facts: [
        "Requires Google Workspace.",
        "No Google warning and no user cap.",
      ],
    },
    personal: {
      name: "Personal accounts too",
      body: "Any Google account, including @gmail.com. The project needs no organisation.",
      facts: [
        "Google warns the person before the permissions, because the app is not verified.",
        "At most 100 new users over the project's whole lifetime.",
        "You need a public privacy policy and a domain of your own.",
        "Another organisation's work account may be blocked by its administrator.",
      ],
    },
    workspaceLead:
      "If a person's work organisation blocks the app, passing the warning does not help. The organisation's administrator can trust the app. Send them:",
    workspaceMsg: (id) =>
      `Hi! A person in your organisation wants to connect their work account to an Open Habitat server I run, but the organisation blocks the app. If you approve, you can trust it like this:\n\nAdmin console › Security › Access and data control › API controls › Manage App Access › Configure new app\nSearch with this Client ID: ${id}\nChoose the organisation or unit › Trusted › Finish.\n\nThe change can take 24 hours.`,
    workspaceRole:
      "Needs the Service Settings privilege in that organisation's Admin console.",
    trustedNote:
      "Trusted applies to that organisation only. It is not Google's verification and changes nothing for personal accounts.",
    trustedWarning:
      "Probably the warning no longer shows for that organisation's people, but Google does not say so directly.",
    readyOrg: [
      "Connect an organisation account in Settings › Data for agents › Google.",
      "Ask an agent to read the latest message.",
    ],
  },
);

```
