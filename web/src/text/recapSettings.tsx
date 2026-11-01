import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Settings › Tilannekatsaus (components/RecapSettings.tsx,
// app/RecapSettings.tsx) and the number stepper it uses.
const fi = {
  automatic: "Automaattiset katsaukset",
  on: "Päällä",
  levels: {
    short: "Lyhyt",
    standard: "Tavallinen",
    thorough: "Perusteellinen",
    custom: "Oma",
    off: "Pois",
  },
  levelNotes: {
    short: "Muutama virke tuoreimmista viesteistä.",
    standard: "Nykyinen katsaus.",
    thorough: "Pidempi katsaus, joka lukee enemmän historiaa.",
    custom: "Omat luvut. Muuttamalla lukua lähdet valmiista tasosta.",
    off: "Automaattiset katsaukset ovat pois päältä. Etusivun keskustelukuvaukset eivät enää päivity, sillä ne tulevat katsauksista. Tee tilannekatsaus nyt toimii edelleen.",
  },
  rows: {
    messages: {
      label: "Luettavat viestit",
      note: "Viimeisimmät viestisi ja agentin vastaukset. Työkalujen tulosteita ei lueta.",
      unit: "viestiä",
    },
    history_tokens: {
      label: "Luettava historia enintään",
      note: "Vanhimmat viestit jäävät pois, kun raja tulee vastaan.",
      unit: "tokenia",
    },
    message_tokens: {
      label: "Yhdestä viestistä enintään",
      note: "Pitkästä viestistä luetaan alku.",
      unit: "tokenia",
    },
    first_after_turns: {
      label: "Ensimmäinen katsaus aikaisintaan",
      note: "Kun keskustelussa on näin monta kysymystä ja vastausta. Itse pyydetty katsaus tehdään heti.",
      unit: "vuoroa",
    },
    words: {
      label: "Katsauksen pituus",
      note: "Yksi tai muutama virke siitä, mitä tehtiin.",
      unit: "sanaa",
    },
    next_words: {
      label: "Seuraavaksi-rivi",
      note: "Yksi seuraava askel tai este.",
      unit: "sanaa",
    },
    response_tokens: {
      label: "Vastauksen yläraja",
      note: "Mallin vastaus katkaistaan tähän.",
      unit: "tokenia",
    },
  },
  sample:
    "Varjon pituuden laskenta tukee nyt kesä- ja talviaikaa: auringon korkeus lasketaan paikallisesta ajasta UTC:n kautta, joten aikavyöhykkeen vaihto ei enää siirrä varjoa tunnilla. Kaikki 18 testiä menevät läpi, ja README:hen lisättiin esimerkki Helsingin talvipäivänseisauksesta. Laskennan tarkkuus tarkistettiin vielä kolmella leveysasteella, ja tulokset vastasivat taulukkoarvoja alle prosentin erolla. Seuraava vaihe on julkaisu, kun muutosloki on päivitetty ja versio nostettu.",
  sampleNext:
    "Julkaise versio 1.4, päivitä muutosloki ja ilmoita käyttäjille muutoksesta kesäajan käsittelyyn sekä uusista esimerkeistä.",
  intro:
    "Lyhyt katsaus keskustelun tilanteesta, kun palaat siihen. Se tallentuu keskustelun historiaan, mutta ei mene agentin muistiin.",
  preview: "Esikatselu",
  delay: "Hiljaisuus ennen katsausta",
  delayDesc:
    "Kortti tulee keskustelun yläpuolelle itsestään, kun keskustelu on ollut näin kauan hiljaa.",
  scope: "Laajuus",
  level: "Katsauksen laajuus",
  reads: "Lukee",
  readsMessages: (n: ReactNode): ReactNode => <>{n} viimeisintä viestiä</>,
  readsTokens: (history: ReactNode, message: string): ReactNode => (
    <>
      noin {history} tokenia, viestistä enintään {message}
    </>
  ),
  readsAfter: (turns: ReactNode): ReactNode => (
    <>aikaisintaan {turns} vuoron jälkeen</>
  ),
  turn: (n: number) => `${n}.`,
  writes: "Kirjoittaa",
  writesWords: (n: ReactNode): ReactNode => <>katsaus enintään {n} sanaa</>,
  writesNext: (n: ReactNode): ReactNode => <>seuraavaksi enintään {n} sanaa</>,
  writesTokens: (n: ReactNode): ReactNode => <>vastaus enintään {n} tokenia</>,
  failed: "Muutosta ei tallennettu. Yritä uudelleen.",
  saving: "Tallennetaan…",
  loading: "Ladataan asetuksia…",
  readFailed:
    "Tilannekatsauksen asetuksia ei saatu luettua. Lataa sivu uudelleen.",
  model: "Malli",
  modelDesc: "Fablea ja Opusta ei käytetä taustatöihin.",
  conversationModel: "Keskustelun oma malli",
  less: (label: string) => `${label}: vähemmän`,
  more: (label: string) => `${label}: enemmän`,
  responseTooLow: (floor: number) =>
    `Raja voi katkaista katsauksen kesken. Nosta se vähintään ${floor} tokeniin.`,
};

export const recapSettingsText = catalog(fi, {
  automatic: "Automatic recaps",
  on: "On",
  levels: {
    short: "Short",
    standard: "Standard",
    thorough: "Thorough",
    custom: "Custom",
    off: "Off",
  },
  levelNotes: {
    short: "A few sentences from the latest messages.",
    standard: "The current recap.",
    thorough: "A longer recap that reads more history.",
    custom: "Your own numbers. Changing a number leaves the preset level.",
    off: "Automatic recaps are off. Home-page conversation descriptions will no longer update because they come from recaps. You can still request a recap now.",
  },
  rows: {
    messages: {
      label: "Messages read",
      note: "Your latest messages and the agent's replies. Tool outputs are not read.",
      unit: "messages",
    },
    history_tokens: {
      label: "History read at most",
      note: "The oldest messages are left out when the limit is reached.",
      unit: "tokens",
    },
    message_tokens: {
      label: "At most from one message",
      note: "The beginning of a long message is read.",
      unit: "tokens",
    },
    first_after_turns: {
      label: "First recap at the earliest",
      note: "When the conversation has this many questions and answers. A recap you ask for is made at once.",
      unit: "turns",
    },
    words: {
      label: "Recap length",
      note: "One or a few sentences about what was done.",
      unit: "words",
    },
    next_words: {
      label: "Next line",
      note: "One next step or obstacle.",
      unit: "words",
    },
    response_tokens: {
      label: "Response limit",
      note: "The model's response is cut here.",
      unit: "tokens",
    },
  },
  sample:
    "Shadow length calculation now handles summer and winter time: the sun's elevation is computed from local time through UTC, so a time zone change no longer moves the shadow by an hour. All 18 tests pass, and the README gained an example of the Helsinki winter solstice. The calculation's accuracy was also checked at three latitudes, and the results matched the table values within one percent. The next step is the release, once the changelog is updated and the version raised.",
  sampleNext:
    "Release version 1.4, update the changelog and tell users about the change in summer time handling and the new examples.",
  intro:
    "A short recap of where a conversation stands when you come back to it. It is saved in the conversation's history but does not enter the agent's memory.",
  preview: "Preview",
  delay: "Quiet time before a recap",
  delayDesc:
    "The card appears above the conversation by itself once the conversation has been quiet this long.",
  scope: "Scope",
  level: "Recap scope",
  reads: "Reads",
  readsMessages: (n) => <>the {n} latest messages</>,
  readsTokens: (history, message) => (
    <>
      about {history} tokens, at most {message} from one message
    </>
  ),
  readsAfter: (turns) => <>at the earliest after turn {turns}</>,
  turn: (n) => `${n}`,
  writes: "Writes",
  writesWords: (n) => <>a recap of at most {n} words</>,
  writesNext: (n) => <>a next line of at most {n} words</>,
  writesTokens: (n) => <>a response of at most {n} tokens</>,
  failed: "The change was not saved. Try again.",
  saving: "Saving…",
  loading: "Loading settings…",
  readFailed: "The recap settings could not be read. Reload the page.",
  model: "Model",
  modelDesc: "Fable and Opus are not used for background work.",
  conversationModel: "The conversation's own model",
  less: (label) => `${label}: less`,
  more: (label) => `${label}: more`,
  responseTooLow: (floor) =>
    `The limit can cut the recap short. Raise it to at least ${floor} tokens.`,
});
