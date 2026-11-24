# text/googleConnect.ts

Generated from web/src/text/googleConnect.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The person's help for Google's own screens while connecting a Google
// account (components/GoogleConnectHelp.tsx). Habitat cannot see Google's
// tab, so every answer is conditional. Google's screens are named only by
// the English labels and error codes Google documents; their Finnish
// wording is not confirmed, and the help says so. The one exception is
// blocked: "Pääsy estetty" is the Finnish heading a person reported from
// Google's refusal of a personal account, and it is what people look for.
const fi = {
  note: "Google voi varoittaa, ettei se ole vahvistanut tämän palvelimen sovellusta.",
  noteCheck: (host: string) => `Jatka vain, jos tunnistat palvelimen ${host}.`,
  blocked:
    "Jos Google sanoo ”Pääsy estetty”, pyydä tämän palvelimen ylläpitäjää sallimaan henkilökohtaiset tilit.",
  more: "Mitä teen, jos Google varoittaa tai pysäyttää?",
  less: "Piilota ohje",
  waitLink: "Google varoitti tai pysäytti?",
  stoppedGroup: "Google pysäytti",
  who: {
    self: "Voit jatkaa itse",
    server: "Kysy tämän palvelimen ylläpitäjältä",
    org: "Kysy työ- tai koulutilin ylläpitäjältä",
    wait: "Odota ja yritä myöhemmin",
  },
  help: {
    warning: "Google varoittaa, ettei se ole vahvistanut sovellusta",
    unfamiliar: "Nimi tai sivu ei näytä tutulta",
    org: "Organisaatiosi ei salli sovellusta",
    internal: "Sovellus on vain sen organisaation tileille",
    testing: "Sovellus on vain testaajille",
    cap: "Sovellus ei ota enempää käyttäjiä",
    rate: "Uusia kirjautumisia on liian monta",
  },
  warningBody:
    "Palvelimen ylläpitäjä on rekisteröinyt Googleen oman sovelluksen, jota Google ei ole tarkastanut. Varoitus ei tarkoita, että jokin olisi rikki.",
  warningCheck: "Jatka vain, jos välilehden osoite alkaa",
  pathLead: "Englanninkielisessä Googlessa:",
  pathNote:
    "Kohdassa … on sovelluksen nimi tai tunnus. Suomenkielisen Googlen sanat voivat olla toiset; niitä ei ole varmistettu.",
  noWarning: "Jos varoitusta ei tule, mitään ei puutu.",
  unfamiliarBody:
    "Älä jatka. Sulje Googlen välilehti, peruuta tämä ikkuna ja kysy palvelimen ylläpitäjältä, millä nimellä sovellus näkyy Googlessa.",
  noShare:
    "Kukaan ei tarvitse Google-salasanaasi eikä paluuosoitetta. Älä anna niitä kenellekään, älä myöskään agentille.",
  orgBody:
    "Työ- tai koulutilisi ylläpitäjä voi luottaa sovellukseen Googlen hallintapaneelissa tällä tunnuksella. Hyväksyntä voi tulla voimaan vasta vuorokauden kuluttua. Henkilökohtaiseen Gmail-tiliin tämä ei vaikuta.",
  clientId: "Sovelluksen tunnus (client ID)",
  internalBody:
    "Sovellus hyväksyy nyt vain ylläpitäjän organisaation tilit. Kirjaudu organisaation tilillä tai pyydä ylläpitäjää sallimaan myös henkilökohtaiset tilit.",
  testingBody:
    "Sovellus on vielä testitilassa. Pyydä palvelimen ylläpitäjää lisäämään tilisi testaajaksi tai julkaisemaan sovellus.",
  capBody:
    "Google rajoittaa, kuinka moni uusi henkilö voi yhdistää vahvistamattomaan sovellukseen, eikä raja nollaudu. Kerro palvelimen ylläpitäjälle.",
  rateBody:
    "Google rajoittaa, kuinka nopeasti uusia henkilöitä voi tulla. Yritä myöhemmin. Jos sama toistuu, kerro palvelimen ylläpitäjälle.",
  code: "Googlen virhetunnus:",
  retryNoHelp: "Uusi yritys ei auta.",
  stoppedAtGoogle:
    "Keskeytit kirjautumisen Googlen sivulla. Mitään ei yhdistetty. Voit avata Googlen uudelleen ja jatkaa tai peruuttaa.",
  googleError: (code: string) =>
    `Google lopetti kirjautumisen virheellä ${code}. Mitään ei yhdistetty. Voit avata Googlen uudelleen tai peruuttaa.`,
  grantLead: "Agentit saivat käyttöönsä",
  grantNo: "ei myönnetty",
  grantPartial: "Voit myöntää puuttuvat myöhemmin kirjautumalla uudelleen.",
  placeholder: "Kuvituskuva, ei Googlen oikea näkymä.",
  alt: {
    warning: "Kuvituskuva Googlen varoituksesta: Advanced-linkki",
    warningOpen: "Kuvituskuva Googlen varoituksesta: Go to … (unsafe) -linkki",
  },
};

export const googleConnectText = catalog(
  fi,
  {
    note: "Google may warn that it has not verified this server's app.",
    noteCheck: (host) => `Continue only if you recognize the server ${host}.`,
    blocked:
      "If Google says “Access blocked”, ask this server's administrator to allow personal accounts.",
    more: "What if Google warns or stops me?",
    less: "Hide help",
    waitLink: "Did Google warn or stop you?",
    stoppedGroup: "Google stopped you",
    who: {
      self: "You can continue yourself",
      server: "Ask this server's administrator",
      org: "Ask the work or school account's administrator",
      wait: "Wait and try later",
    },
    help: {
      warning: "Google warns that it has not verified the app",
      unfamiliar: "The name or page does not look familiar",
      org: "Your organization does not allow the app",
      internal: "The app is only for its organization's accounts",
      testing: "The app is only for testers",
      cap: "The app takes no more users",
      rate: "Too many new sign-ins",
    },
    warningBody:
      "The server's administrator registered their own app with Google, and Google has not reviewed it. The warning does not mean anything is broken.",
    warningCheck: "Continue only if the tab's address starts with",
    pathLead: "In English Google:",
    pathNote:
      "At … is the app's name or identifier. Google in other languages may use other words; they are not confirmed.",
    noWarning: "If no warning appears, nothing is missing.",
    unfamiliarBody:
      "Do not continue. Close Google's tab, cancel this dialog and ask the server's administrator what name the app shows in Google.",
    noShare:
      "Nobody needs your Google password or the return address. Do not give them to anyone, an agent included.",
    orgBody:
      "Your work or school account's administrator can trust the app in Google's admin console with this identifier. Approval can take a day to apply. It does not affect a personal Gmail account.",
    clientId: "App identifier (client ID)",
    internalBody:
      "The app accepts only the administrator's organization accounts for now. Sign in with an organization account, or ask the administrator to allow personal accounts too.",
    testingBody:
      "The app is still in testing. Ask the server's administrator to add your account as a tester or to publish the app.",
    capBody:
      "Google limits how many new people can connect to an unverified app, and the limit does not reset. Tell the server's administrator.",
    rateBody:
      "Google limits how fast new people can join. Try later. If it happens again, tell the server's administrator.",
    code: "Google's error code:",
    retryNoHelp: "Trying again does not help.",
    stoppedAtGoogle:
      "You stopped the sign-in on Google's page. Nothing was connected. You can open Google again and continue, or cancel.",
    googleError: (code) =>
      `Google ended the sign-in with the error ${code}. Nothing was connected. You can open Google again, or cancel.`,
    grantLead: "Agents can now use",
    grantNo: "not granted",
    grantPartial: "You can grant the missing ones later by signing in again.",
    placeholder: "Illustration, not Google's real screen.",
    alt: {
      warning: "Illustration of Google's warning: the Advanced link",
      warningOpen:
        "Illustration of Google's warning: the Go to … (unsafe) link",
    },
  },
  {
    noteCheck: (host) => `Continue only if you recognise the server ${host}.`,
    help: {
      warning: "Google warns that it has not verified the app",
      unfamiliar: "The name or page does not look familiar",
      org: "Your organisation does not allow the app",
      internal: "The app is only for its organisation's accounts",
      testing: "The app is only for testers",
      cap: "The app takes no more users",
      rate: "Too many new sign-ins",
    },
    internalBody:
      "The app accepts only the administrator's organisation accounts for now. Sign in with an organisation account, or ask the administrator to allow personal accounts too.",
  },
);

```
