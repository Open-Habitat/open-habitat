# text/onboardingSettings.tsx

Generated from web/src/text/onboardingSettings.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// Settings › Käyttöönotto: the new person's route and its preview
// (components/OnboardingSettings.tsx, app/OnboardingAdministration.tsx,
// the refusals of app/onboardingConfig.ts).
const fi = {
  modes: {
    preselected: "Esivalitse",
    auto: "Hae automaattisesti",
    skip: "Ohita vaihe",
  },
  listLabel: {
    preselected: "Esivalitut repot",
    auto: "Automaattisesti haettavat repot",
    skip: "Taustalla tuotavat repot",
  },
  listHint: {
    preselected: "Valmiiksi valittuina henkilön repovalitsimessa.",
    auto: "Haetaan heti GitHub-kirjautumisen jälkeen. Henkilö voi valita lisää.",
    skip: "Valinnaisia. Tuodaan taustalla ilman repovaihetta.",
  },
  repos: (n: number) => `${n} ${n === 1 ? "oletusrepo" : "oletusrepoa"}`,
  effectPreselected: (w: string) =>
    `Repovalitsin avautuu, ja ${w} on valmiiksi valittuna. Henkilö voi poistaa valinnan ja valita muita.`,
  effectPreselectedNone: "Repovalitsin avautuu ilman esivalintoja.",
  effectAuto: (w: string) =>
    `${w} haetaan heti GitHub-kirjautumisen jälkeen. Repovalitsimessa henkilö voi valita lisää.`,
  effectAutoNone:
    "Mitään ei haeta automaattisesti. Lisää ainakin yksi repo, tai repovalitsin avautuu ilman haettavia.",
  effectSkip: (w: string) =>
    `Repovaihetta ei näytetä. ${w} tuodaan taustalla, ja reitin Repot-rivi kertoo sen.`,
  effectSkipNone:
    "Repovaihetta ei näytetä eikä mitään haeta. Repoja voi hakea myöhemmin työtilanäkymästä.",
  hintPreselected: (n: number) => `${n} esivalittuna`,
  personChooses: "Henkilö valitsee",
  hintAuto: (n: number) => `${n} haetaan automaattisesti`,
  nothingToFetch: "Ei mitään haettavaa",
  hintSkip: (n: number) => `Ohitetaan · ${n} tuodaan`,
  skipped: "Ohitetaan",
  how: {
    chatgpt:
      "Kirjautuminen OpenAI:n sivulla lyhyellä koodilla. Käyttö kuuluu tilaukseen.",
    claude:
      "Kirjautuminen Clauden sivulla ja koodi takaisin tänne. Käyttö kuuluu tilaukseen.",
    openai_key: "Henkilö liittää oman avaimensa. OpenAI laskuttaa käytöstä.",
    anthropic_key:
      "Henkilö liittää oman avaimensa. Anthropic laskuttaa käytöstä.",
    deepseek_key:
      "Henkilö liittää oman avaimensa. DeepSeek laskuttaa käytöstä.",
  } as Record<string, string>,
  aiSiteKey: (key: string) =>
    `Ohitetaan · sivuston ${key ? `${key}-` : ""}avain`,
  aiDefault: (name: string) => `Oletus: ${name}`,
  hiddenUnoffered: "Piilotettu · ei tarjolla",
  required: "Pakollinen",
  optional: "Voi ohittaa",
  repositories: "Repot",
  ai: "AI-tili",
  addIntegration: "Lisää integraatio",
  route: "Uuden henkilön reitti",
  routeSteps: "Käyttöönoton vaiheet, kiinteä järjestys",
  signIn: "Kirjautuminen",
  newStep: "Uusi vaihe ennen AI-tiliä",
  personSees: "Henkilö näkee:",
  repoMode: "Repojen aloitustapa",
  defaultRepos: "Oletusrepot:",
  private: "Yksityinen",
  removeRepo: (name: string) => `Poista ${name} oletusrepoista`,
  remove: "Poista",
  noDefaults: "Ei oletusrepoja.",
  maxDefaults: (n: number) => `Oletusrepoja voi olla enintään ${n}.`,
  addRepo: "Lisää oletusrepo…",
  accessRule:
    "Repo haetaan vain, jos henkilöllä on siihen pääsy omalla GitHub-tilillään. Muuten se jätetään pois näyttämättä nimeä henkilölle.",
  notOffered: "Ei tarjolla",
  unknown: "Tila ei tiedossa",
  requiredOf: (name: string) => `${name}: pakollisuus`,
  removeIntegration: (name: string) => `Poista ${name} käyttöönotosta`,
  hiddenNotOffered:
    "Integraatiota ei tarjota tällä palvelimella, joten vaihe on piilotettu uusilta henkilöiltä. Se näkyy taas, kun integraatio on tarjolla.",
  hiddenUnknown:
    "Integraatioiden tilaa ei voitu lukea. Vaihe näkyy uusille henkilöille vain, kun integraatio on valmis käyttöön.",
  nothingShown: "Ei mitään. Vaihetta ei näytetä.",
  requiredEffect: (name: string) =>
    `${name} on oma vaiheensa, eikä sitä voi ohittaa. Vaihe ei estä työtilojen käyttöä.`,
  optionalEffect: (name: string) =>
    `${name} ehdotetaan omana vaiheenaan; sen voi ohittaa.`,
  addIntro:
    "Jokainen lisätty integraatio on oma vaiheensa ennen AI-tiliä. Integraatiot ovat reitillä samassa järjestyksessä kuin Integraatiot-sivulla. Vain käyttöön valmiin integraation voi lisätä.",
  noneReady: "Yksikään lisäämätön integraatio ei ole valmis käyttöön.",
  add: "Lisää",
  way: "Tapa",
  aiWay: "AI-tilin tapa",
  wayDefault: "Oletus",
  waySiteKey: "Sivuston avain",
  defaultFor: "Oletus uudelle henkilölle",
  keySet: (name: string, suffix: ReactNode): ReactNode => (
    <>
      {name}-avain {suffix} on asetettu.{" "}
    </>
  ),
  keyNotSet: "Avainta ei ole asetettu. ",
  changeKey: "Vaihda tai poista AI-avain",
  setKey: "Aseta AI-avain",
  noAiStep: (name: string) =>
    `Ei AI-vaihetta: agentit käyttävät sivuston ${name}-avainta.`,
  untilStored:
    "Kunnes avain on tallennettu, henkilö näkee vaiheen kuten ennen.",
  allOptions: "Kaikki AI-vaihtoehdot rinnakkain, ja henkilö valitsee niistä.",
  onlyOption: (name: string) =>
    `Vain ${name}. Muut vaihtoehdot ovat linkin › Käytä muuta AI-palvelua takana.`,
  addLater:
    "Henkilö voi lisätä muita tilejä myöhemmin kohdassa Asetukset › Tekoäly. AI-vaihe ohitetaan, jos henkilöllä on jo toimivat tunnukset.",
  stepSettings: (step: string) => `${step}: asetukset`,
  yourSettings: "Sinun asetuksesi",
  githubStep:
    "Jokainen aloittaa kirjautumalla GitHub-tilillään. Kirjautuminen tunnistaa henkilön ja antaa hänen omille työkaluilleen pääsyn hänen repoihinsa. Vaihetta ei voi muuttaa.",
  integrationGone: "Integraatiota ei ole enää käyttöönotossa.",
  saving: "Tallennetaan…",
  saved: "Tallennettu",
  savesAtOnce: "Muutokset tallentuvat heti.",
  notSaved: "Ei tallennettu",
  refused: (text: string) => `Muutosta ei tallennettu. ${text}`,
  conflict:
    "Käyttöönottoa on muutettu toisaalla sen jälkeen, kun avasit sen. Viimeisintä muutostasi ei tallennettu. Lataa nykyinen versio ja tee muutos uudelleen.",
  uncertain:
    "Tallennusta ei voitu vahvistaa. Muutos on voinut tallentua. Lataa nykyinen versio ennen kuin jatkat.",
  reloadCurrent: "Lataa nykyinen versio",
  lede: "Mitä uusi henkilö käy läpi ensimmäisellä kirjautumisella. Vaiheiden järjestys on kiinteä. Muutos tallentuu heti ja koskee seuraavaa uutta käyttöönottoa; jo liittyneet eivät muutu.",
  showPreview: "Näytä henkilön näkymä",
  inPanel: "Asetukset ovat esikatselun sivupaneelissa.",
  previewNote:
    "Muutos näkyy esikatselussa heti ja aloittaa sen alusta. Se myös tallentuu heti.",
  signedIn: "Kirjautunut",
  siteFetches: (n: number) =>
    `Sivusto hakee ${n} ${n === 1 ? "repon" : "repoa"}`,
  chooseRepos: "Valitse GitHub-repot haettaviksi",
  chooseReposLead:
    "Valitse repot, joita haluat käyttää täällä. Ne haetaan työtiloiksi taustalla.",
  alreadyFetches: (n: number) =>
    `Sivusto hakee sinulle jo ${n} ${n === 1 ? "repon" : "repoa"}. Valitse tästä vain lisää.`,
  preselectedFor: (n: number) =>
    `Sivusto on valinnut valmiiksi ${n} ${n === 1 ? "repon" : "repoa"}. Voit poistaa valinnan.`,
  siteFetchesShort: "Sivusto hakee",
  previewOnlyDefaults:
    "Esikatselu näyttää vain sivuston oletusrepot. Henkilö näkee myös omat repojensa, eikä hän näe oletusrepoa, johon hänellä ei ole pääsyä.",
  continue: "Jatka",
  connectOwn: (name: string) =>
    `Yhdistä oma ${name}-tilisi, jos agenttisi pitää käyttää sen tietoja.`,
  later: (place: string) =>
    ` Voit tehdä tämän myöhemmin kohdassa Asetukset › ${place}.`,
  connect: "Yhdistä…",
  continuePreview: "Jatka (esikatselu)",
  continueWithout: "Jatka ilman tiliä",
  signInAi: "Kirjaudu AI-palveluun",
  saveKey: "Tallenna avain",
  signInEllipsis: "Kirjaudu…",
  ready: "Valmista",
  workspacesNext: "Seuraavaksi avautuvat henkilön työtilat.",
  previewTitle: "Esikatselu: uuden henkilön näkymä",
  preview: "Esikatselu",
  previewLead:
    "Näin uusi henkilö näkee käyttöönoton. Esikatselussa painetut eivät tallennu.",
  device: "Esikatselun laite",
  desktop: "Tietokone",
  phone: "Puhelin",
  restart: "Aloita alusta",
  closePreview: "Sulje esikatselu",
  yourSettingsPanel: "Asetuksesi",
  addDefault: "Lisää oletusrepo",
  finderLead:
    "Näet omat GitHub-repojesi. Uuden henkilön pääsy tarkistetaan hänen omalla tilillään. Valitun repon voi poistaa valitsemalla sen uudelleen.",
  githubFault: "GitHub-yhteys ei toimi, joten nimeä ei voi tarkistaa.",
  githubSilent: "GitHub ei vastannut, joten nimeä ei voi tarkistaa.",
  typeName:
    "Voit silti lisätä oletusrepon kirjoittamalla sen nimen muodossa omistaja/repo; pääsy tarkistetaan jokaisen uuden henkilön omalla tilillä.",
  loadFailed: "Käyttöönoton asetuksia ei voitu ladata.",
  reload: "Lataa uudelleen",
  loading: "Ladataan käyttöönoton asetuksia…",
  refusals: {
    version_conflict:
      "Käyttöönottoa on muutettu toisaalla sen jälkeen, kun avasit sen. Lataa nykyinen versio ja tee muutoksesi uudelleen.",
    invalid_repository_name: "Jokin oletusrepo ei ole muotoa omistaja/repo.",
    duplicate_default: "Sama oletusrepo on listassa kahdesti.",
    duplicate_destination:
      "Kahdella oletusrepolla on sama nimi eri omistajilla. Henkilölle voi hakea niistä vain yhden.",
    unknown_provider: "Integraatioiden lista ei kelpaa palvelimelle.",
    duplicate_provider: "Integraatioiden lista ei kelpaa palvelimelle.",
    site_key_unavailable: "Sivuston avainta ei ole tallennettu.",
    site_key_stored:
      "Sivuston avain on käytössä. Poista avain ennen kuin vaihdat tapaa.",
    invalid_key: "Avain ei kelpaa valitulle palvelulle.",
    admin_required: "Ylläpito-oikeutesi on poistettu.",
    csrf_denied: "Istunto ei kelpaa enää. Lataa sivu uudelleen.",
    origin_denied: "Istunto ei kelpaa enää. Lataa sivu uudelleen.",
  } as Record<string, string>,
  tooManyDefaults: (n: number) => `Oletusrepoja voi olla enintään ${n}.`,
  refusedDefault: "Palvelin ei hyväksynyt muutosta.",
  chosen: "✓ valittu",
  defaultReposCount: (n: number, max: number) => `${n} / ${max} oletusrepoa`,
  done: "Valmis",
};

export const onboardingSettingsText = catalog(fi, {
  modes: {
    preselected: "Preselect",
    auto: "Fetch automatically",
    skip: "Skip the step",
  },
  listLabel: {
    preselected: "Preselected repositories",
    auto: "Repositories fetched automatically",
    skip: "Repositories imported in the background",
  },
  listHint: {
    preselected: "Already chosen in the person's repository picker.",
    auto: "Fetched right after the GitHub sign-in. The person can choose more.",
    skip: "Optional. Imported in the background without a repository step.",
  },
  repos: (n) =>
    `${n} default ${plural("en", n, { one: "repository", other: "repositories" })}`,
  effectPreselected: (w) =>
    `The repository picker opens with ${w} already chosen. The person can clear the choice and choose others.`,
  effectPreselectedNone:
    "The repository picker opens with nothing preselected.",
  effectAuto: (w) =>
    `${w} fetched right after the GitHub sign-in. In the repository picker the person can choose more.`,
  effectAutoNone:
    "Nothing is fetched automatically. Add at least one repository, or the picker opens with nothing to fetch.",
  effectSkip: (w) =>
    `The repository step is not shown. ${w} imported in the background, and the route's Repositories row says so.`,
  effectSkipNone:
    "The repository step is not shown and nothing is fetched. Repositories can be fetched later from the workspace view.",
  hintPreselected: (n) => `${n} preselected`,
  personChooses: "The person chooses",
  hintAuto: (n) => `${n} fetched automatically`,
  nothingToFetch: "Nothing to fetch",
  hintSkip: (n) => `Skipped · ${n} imported`,
  skipped: "Skipped",
  how: {
    chatgpt:
      "Signing in on OpenAI's page with a short code. Use is part of the subscription.",
    claude:
      "Signing in on Claude's page and the code back here. Use is part of the subscription.",
    openai_key: "The person pastes their own key. OpenAI bills for use.",
    anthropic_key: "The person pastes their own key. Anthropic bills for use.",
    deepseek_key: "The person pastes their own key. DeepSeek bills for use.",
  },
  aiSiteKey: (key) => `Skipped · the site's ${key ? `${key} ` : ""}key`,
  aiDefault: (name) => `Default: ${name}`,
  hiddenUnoffered: "Hidden · not offered",
  required: "Required",
  optional: "Can skip",
  repositories: "Repositories",
  ai: "AI account",
  addIntegration: "Add integration",
  route: "A new person's route",
  routeSteps: "Onboarding steps, fixed order",
  signIn: "Sign-in",
  newStep: "A new step before the AI account",
  personSees: "The person sees:",
  repoMode: "How repositories start",
  defaultRepos: "Default repositories:",
  private: "Private",
  removeRepo: (name) => `Remove ${name} from the default repositories`,
  remove: "Remove",
  noDefaults: "No default repositories.",
  maxDefaults: (n) => `There can be at most ${n} default repositories.`,
  addRepo: "Add default repository…",
  accessRule:
    "A repository is fetched only if the person has access to it with their own GitHub account. Otherwise it is left out without showing its name to the person.",
  notOffered: "Not offered",
  unknown: "State unknown",
  requiredOf: (name) => `${name}: required`,
  removeIntegration: (name) => `Remove ${name} from onboarding`,
  hiddenNotOffered:
    "The integration is not offered on this server, so the step is hidden from new people. It shows again once the integration is offered.",
  hiddenUnknown:
    "The integrations' state could not be read. The step shows to new people only once the integration is ready for use.",
  nothingShown: "Nothing. The step is not shown.",
  requiredEffect: (name) =>
    `${name} is a step of its own and cannot be skipped. The step does not block using the workspaces.`,
  optionalEffect: (name) =>
    `${name} is suggested as a step of its own; it can be skipped.`,
  addIntro:
    "Each added integration is a step of its own before the AI account. The integrations are on the route in the same order as on the Integrations page. Only an integration ready for use can be added.",
  noneReady: "None of the integrations not yet added is ready for use.",
  add: "Add",
  way: "Way",
  aiWay: "The AI account's way",
  wayDefault: "Default",
  waySiteKey: "Site key",
  defaultFor: "Default for a new person",
  keySet: (name, suffix) => (
    <>
      The {name} key {suffix} is set.{" "}
    </>
  ),
  keyNotSet: "No key is set. ",
  changeKey: "Change or remove the AI key",
  setKey: "Set the AI key",
  noAiStep: (name) => `No AI step: agents use the site's ${name} key.`,
  untilStored: "Until the key is saved, the person sees the step as before.",
  allOptions: "All AI options side by side, and the person chooses.",
  onlyOption: (name) =>
    `Only ${name}. The other options are behind the link › Use another AI service.`,
  addLater:
    "The person can add other accounts later under Settings › AI. The AI step is skipped if the person already has working credentials.",
  stepSettings: (step) => `${step}: settings`,
  yourSettings: "Your settings",
  githubStep:
    "Everyone starts by signing in with their GitHub account. The sign-in identifies the person and gives their own tools access to their repositories. The step cannot be changed.",
  integrationGone: "The integration is no longer in onboarding.",
  saving: "Saving…",
  saved: "Saved",
  savesAtOnce: "Changes are saved at once.",
  notSaved: "Not saved",
  refused: (text) => `The change was not saved. ${text}`,
  conflict:
    "Onboarding has been changed elsewhere since you opened it. Your latest change was not saved. Load the current version and make the change again.",
  uncertain:
    "Saving could not be confirmed. The change may have been saved. Load the current version before you continue.",
  reloadCurrent: "Load the current version",
  lede: "What a new person goes through at their first sign-in. The order of the steps is fixed. A change is saved at once and applies to the next new onboarding; people who already joined do not change.",
  showPreview: "Show the person's view",
  inPanel: "The settings are in the preview's side panel.",
  previewNote:
    "A change shows in the preview at once and restarts it. It is also saved at once.",
  signedIn: "Signed in",
  siteFetches: (n) =>
    `The site fetches ${n} ${plural("en", n, { one: "repository", other: "repositories" })}`,
  chooseRepos: "Choose GitHub repositories to fetch",
  chooseReposLead:
    "Choose the repositories you want to use here. They are fetched as workspaces in the background.",
  alreadyFetches: (n) =>
    `The site already fetches ${n} ${plural("en", n, { one: "repository", other: "repositories" })} for you. Choose only more here.`,
  preselectedFor: (n) =>
    `The site has preselected ${n} ${plural("en", n, { one: "repository", other: "repositories" })}. You can clear the choice.`,
  siteFetchesShort: "The site fetches",
  previewOnlyDefaults:
    "The preview shows only the site's default repositories. The person also sees their own repositories, and does not see a default repository they have no access to.",
  continue: "Continue",
  connectOwn: (name) =>
    `Connect your own ${name} account if your agent needs to use its data.`,
  later: (place) => ` You can do this later under Settings › ${place}.`,
  connect: "Connect…",
  continuePreview: "Continue (preview)",
  continueWithout: "Continue without an account",
  signInAi: "Sign in to an AI service",
  saveKey: "Save key",
  signInEllipsis: "Sign in…",
  ready: "All set",
  workspacesNext: "Next the person's workspaces open.",
  previewTitle: "Preview: a new person's view",
  preview: "Preview",
  previewLead:
    "This is how a new person sees onboarding. Presses in the preview are not saved.",
  device: "Preview device",
  desktop: "Computer",
  phone: "Phone",
  restart: "Start over",
  closePreview: "Close preview",
  yourSettingsPanel: "Your settings",
  addDefault: "Add default repository",
  finderLead:
    "You see your own GitHub repositories. A new person's access is checked with their own account. A chosen repository can be removed by choosing it again.",
  githubFault:
    "The GitHub connection does not work, so the name cannot be checked.",
  githubSilent: "GitHub did not answer, so the name cannot be checked.",
  typeName:
    "You can still add a default repository by typing its name as owner/repository; access is checked with each new person's own account.",
  loadFailed: "The onboarding settings could not be loaded.",
  reload: "Reload",
  loading: "Loading the onboarding settings…",
  refusals: {
    version_conflict:
      "Onboarding has been changed elsewhere since you opened it. Load the current version and make your changes again.",
    invalid_repository_name:
      "A default repository is not of the form owner/repository.",
    duplicate_default: "The same default repository is in the list twice.",
    duplicate_destination:
      "Two default repositories have the same name under different owners. Only one of them can be fetched for a person.",
    unknown_provider: "The list of integrations is not valid for the server.",
    duplicate_provider: "The list of integrations is not valid for the server.",
    site_key_unavailable: "The site key has not been saved.",
    site_key_stored:
      "The site key is in use. Remove the key before changing the way.",
    invalid_key: "The key is not valid for the chosen service.",
    admin_required: "Your administrator rights have been removed.",
    csrf_denied: "The session is no longer valid. Reload the page.",
    origin_denied: "The session is no longer valid. Reload the page.",
  },
  tooManyDefaults: (n) => `There can be at most ${n} default repositories.`,
  refusedDefault: "The server did not accept the change.",
  chosen: "✓ chosen",
  defaultReposCount: (n, max) => `${n} / ${max} default repositories`,
  done: "Done",
});

```
