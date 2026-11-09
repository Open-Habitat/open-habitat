import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Choosing a model: the shared picker and field (components/ModelPicker.tsx,
// ModelField.tsx, ModelChip.tsx, modelPresentation.ts), Pi's selector and
// default (app/PiModelSelector.tsx, app/PiModels.tsx) and the default model
// row of Settings › Tekoäly (components/DefaultModelRow.tsx).
const fi = {
  routes: {
    "openai-codex": "ChatGPT-tilaus",
    "claude-bridge": "Claude-tilaus",
    openai: "OpenAI API",
    anthropic: "Anthropic API",
    deepseek: "DeepSeek API",
  },
  notChosen: "Ei valittu",
  loading: "Ladataan…",
  automatic: "Automaattinen",
  fieldLabel: (
    label: string,
    auto: boolean,
    name: string,
    route?: string,
    thinking?: string,
  ) =>
    `${label}: ${auto ? "Automaattinen, " : ""}${name}${route ? `, ${route}` : ""}${thinking ? `, ajattelu ${thinking}` : ""}`,
  close: "Sulje",
  summary: (model: string, thinking: string) =>
    `${model} · ajattelutaso ${thinking}`,
  modelUnknown: "Malli ei tiedossa",
  unknown: "Ei tiedossa",
  unavailable: "Ei käytettävissä",
  refusedTitle:
    "Palveluntarjoaja torjui mallin tällä tunnuksella. Valitse toinen malli.",
  currentBroken:
    "Nykyinen malli ei toimi tililläsi. Valitse toinen ennen uuden keskustelun aloittamista.",
  oldRefusal:
    "Yli viikon vanhan torjunnan jälkeen mallin voi valita uudelleen. Tilauksesi on voinut muuttua.",
  older: (n: number) => `Vanhemmat mallit (${n})`,
  thinking: "Ajattelutaso",
  supportedLevel: (level: string) => `Mallin tukema taso: ${level}`,
  catalogUnavailable: (link: ReactNode): ReactNode => (
    <>
      Agentin malliluetteloa ei saatu. Alla ovat vain keskusteluista tutut
      mallit. Tarkista kirjautumiset kohdassa {link}.
    </>
  ),
  ai: "Tekoäly",
  provider: "Palveluntarjoaja",
  claudeUnavailable:
    "Claude-tilaus ei ole käytettävissä: kirjautumista ei ole vahvistettu.",
  aiSettings: "Tekoäly-asetukset",
  currentDefault: (route: string) =>
    `Nykyinen agentin oletus: ${route}. Sitä ei muuteta automaattisesti.`,
  notForBackground: "Ei taustatöihin",
  now: (name: string) => `Nyt ${name}`,
  conversationOwn: "Keskustelun oma malli",
  alsoDefault: "Tee siitä myös uusien keskustelujen oletus",
  notChanged:
    "Tämän keskustelun mallia ei vaihdeta. Aiemmin lähetettyä viestiä ei toisteta. Luonnos säilyy.",
  changeDefault: "Muuta oletusmallia",
  choose: "Valitse",
  startWith: (model: string) => `Aloita uusi keskustelu mallilla ${model}`,
  savedToPi:
    "Tallentuu Pi:n omaan oletukseen (~/.pi/agent/settings.json), joten sama malli on käytössä myös SSH:lla. Avoimet keskustelut eivät vaihdu.",
  noModels: "Agentin malleja ei saada. Tarkista kirjautuminen.",
  loadingModels: "Ladataan agentin malleja…",
  saving: "Tallennetaan valintaa…",
  confirming: "Agentti vahvistaa valintaa…",
  confirmed: "Valinta vahvistettu.",
  defaultRefused: (reason: string) =>
    `Oletusta ei vaihdettu: ${reason} Aiempi valinta palautettiin.`,
  saveUncertain: "Mallin tallennusta ei voitu vahvistaa. Yritä uudelleen.",
  session: "Istunto ei sallinut tallennusta. Kirjaudu uudelleen.",
  busy: "Agentin asetukset olivat varattuina. Yritä hetken päästä uudelleen.",
  notSaved: "Agentti ei tallentanut valintaa oletukseksi.",
  defaultModel: "Oletusmalli",
  forNew: "Uusille keskusteluille",
  defaultBroken: (name: string, route: string, signIn: boolean) =>
    `${name} (${route}) ei vastannut viimeksi. Valitse toinen oletus tai korjaa ${signIn ? "kirjautuminen" : "avain"} alla.`,
  thinkingLevelHidden: "· ajattelutaso",
  // What each family is good for compared with the same provider's others,
  // for a person who does not follow models (modelPresentation.ts). Ordered
  // by capability; an unknown family has no entry and shows nothing. "Kallis"
  // means the usage limit on a subscription and the bill on an API key.
  families: {
    fable: "Kyvykkäin vaikeimpiin töihin; hitain ja kallein.",
    opus: "Taitava vaativaan työhön; melko kallis.",
    sonnet: "Yleismalli arkeen; Opusta nopeampi ja edullisempi.",
    haiku: "Nopein ja edullisin: lyhyet, yksinkertaiset työt.",
    astra: "Kyvykkäin vaikeimpiin töihin; hitain ja kallein.",
    sol: "Yleismalli arkeen; Astraa nopeampi ja edullisempi.",
    terra: "Solia kevyempi, kun nopeus painaa enemmän.",
    luna: "Nopein ja edullisin: lyhyet, yksinkertaiset työt.",
  },
  thinkingAbout:
    "Kuinka paljon malli miettii ennen vastausta. Korkeampi taso auttaa vaikeissa töissä, mutta on hitaampi ja kalliimpi.",
  // The same in one line under the level control, where the picker must fit
  // a laptop screen without scrolling.
  thinkingShort: "Korkeampi: perusteellisempi, hitaampi ja kalliimpi.",
};

export const modelsText = catalog(fi, {
  routes: {
    "openai-codex": "ChatGPT subscription",
    "claude-bridge": "Claude subscription",
    openai: "OpenAI API",
    anthropic: "Anthropic API",
    deepseek: "DeepSeek API",
  },
  notChosen: "Not chosen",
  loading: "Loading…",
  automatic: "Automatic",
  fieldLabel: (label, auto, name, route, thinking) =>
    `${label}: ${auto ? "Automatic, " : ""}${name}${route ? `, ${route}` : ""}${thinking ? `, thinking ${thinking}` : ""}`,
  close: "Close",
  summary: (model, thinking) => `${model} · thinking level ${thinking}`,
  modelUnknown: "Model unknown",
  unknown: "Unknown",
  unavailable: "Not available",
  refusedTitle:
    "The provider refused the model with these credentials. Choose another model.",
  currentBroken:
    "The current model does not work on your account. Choose another before starting a new conversation.",
  oldRefusal:
    "After a refusal older than a week the model can be chosen again. Your subscription may have changed.",
  older: (n) => `Older models (${n})`,
  thinking: "Thinking level",
  supportedLevel: (level) => `Level the model supports: ${level}`,
  catalogUnavailable: (link) => (
    <>
      The agent's model list did not arrive. Below are only the models known
      from conversations. Check the sign-ins under {link}.
    </>
  ),
  ai: "AI",
  provider: "Provider",
  claudeUnavailable:
    "The Claude subscription is not available: the sign-in has not been confirmed.",
  aiSettings: "AI settings",
  currentDefault: (route) =>
    `The agent's current default: ${route}. It is not changed automatically.`,
  notForBackground: "Not for background work",
  now: (name) => `Now ${name}`,
  conversationOwn: "The conversation's own model",
  alsoDefault: "Also make it the default of new conversations",
  notChanged:
    "This conversation's model is not changed. A message already sent is not repeated. The draft stays.",
  changeDefault: "Change the default model",
  choose: "Choose",
  startWith: (model) => `Start a new conversation with ${model}`,
  savedToPi:
    "Saved to Pi's own default (~/.pi/agent/settings.json), so the same model is used over SSH too. Open conversations do not change.",
  noModels: "The agent's models cannot be fetched. Check the sign-in.",
  loadingModels: "Loading the agent's models…",
  saving: "Saving the choice…",
  confirming: "The agent is confirming the choice…",
  confirmed: "Choice confirmed.",
  defaultRefused: (reason) =>
    `The default was not changed: ${reason} The previous choice was restored.`,
  saveUncertain: "Saving the model could not be confirmed. Try again.",
  session: "The session did not allow saving. Sign in again.",
  busy: "The agent's settings were busy. Try again in a moment.",
  notSaved: "The agent did not save the choice as the default.",
  defaultModel: "Default model",
  forNew: "For new conversations",
  defaultBroken: (name, route, signIn) =>
    `${name} (${route}) did not answer last time. Choose another default or fix the ${signIn ? "sign-in" : "key"} below.`,
  thinkingLevelHidden: "· thinking level",
  families: {
    fable: "Most capable, for the hardest work; slowest and costliest.",
    opus: "Skilled at demanding work; fairly costly.",
    sonnet: "An everyday all-rounder; faster and cheaper than Opus.",
    haiku: "The fastest and cheapest, for short, simple tasks.",
    astra: "Most capable, for the hardest work; slowest and costliest.",
    sol: "An everyday all-rounder; faster and cheaper than Astra.",
    terra: "Lighter than Sol, for when speed matters more.",
    luna: "The fastest and cheapest, for short, simple tasks.",
  },
  thinkingAbout:
    "How much the model thinks before answering. A higher level helps with hard work but is slower and costlier.",
  thinkingShort: "Higher: more thorough, slower and costlier.",
});
