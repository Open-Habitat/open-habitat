import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The workspace page's icon picker (components/WorkspaceIconPicker.tsx) and
// its suggestion row (components/WorkspaceIconSuggestions.tsx). A quick
// wish's value is sent to the model as the wish itself.
// Agent reference: wishes allow 4096 characters; attachments are images or
// UTF-8 text (64 KiB total text), used as references, not icon choices.
// Suggestion input includes the workspace name, README excerpt, start page,
// languages and logo path. The service chooses the available signed-in model.
const fi = {
  change: "Vaihda kuvake",
  title: "Työtilan kuvake",
  close: "Sulje",
  auto: "Automaattinen",
  autoLogo: (path: ReactNode): ReactNode => <>repon logo {path}</>,
  autoDerived: "nimestä johdettu tunnus",
  logo: "Repon logo",
  lettersNamed: (letters: string) => `Kirjaintunnus ${letters}`,
  letters: "Kirjaintunnus",
  lettersHint: "1–3 kirjainta",
  lettersField: "Kirjaimet",
  emoji: "Emoji",
  own: "Oma emoji",
  ownPlaceholder: "Oma emoji, esim. 🧮",
  use: "Käytä",
  oneEmoji: "Kelpaa yksi emoji.",
  // The suggestion row.
  quick: [
    ["leikkisämpi", "Leikkisämpi"],
    ["asiallisempi", "Asiallisempi"],
    ["kirjaimet", "Kirjaimet"],
    ["toisia", "Toisia"],
  ] as [string, string][],
  failure: {
    model_unavailable: [
      "Ehdotuksiin ei löytynyt mallia, johon on kirjautuminen.",
      "Kirjaudu mallipalveluun asetuksista.",
    ],
    model_timeout: ["Malli ei vastannut ajoissa.", "Voit yrittää uudelleen."],
    model_invalid_response: [
      "Mallin vastauksesta ei saatu kuvaketta.",
      "Voit yrittää uudelleen.",
    ],
    request_failed: ["Ehdotuksia ei saatu.", "Voit yrittää uudelleen."],
  } as Record<string, [string, string]>,
  rowLabel: "Kuvake-ehdotus",
  suggestion: "Ehdotus",
  thinking: "Malli miettii…",
  reading: "Malli lukee työtilan tietoja…",
  earlierKept: "Edelliset ehdotukset ovat yhä tässä.",
  withoutModel: "Alla vaihtoehdot ilman mallia.",
  openSettings: "Avaa asetukset",
  retry: "Yritä uudelleen",
  suggestions: "Ehdotuksia:",
  notNow: "Ei nyt",
  wishLabel: "Toive mallille",
  wishHint: "Voit liittää kuvan tai tekstin esimerkiksi.",
  wishPlaceholder: "Toive, esim. kettu, sininen, kirjaimet",
  suggest: "Ehdota",
  previous: "Edelliset ehdotukset",
  next: "Seuraavat ehdotukset",
};

export const workspaceIconPickerText = catalog(fi, {
  change: "Change icon",
  title: "Workspace icon",
  close: "Close",
  auto: "Automatic",
  autoLogo: (path) => <>repository logo {path}</>,
  autoDerived: "letters from the name",
  logo: "Repository logo",
  lettersNamed: (letters) => `Letters ${letters}`,
  letters: "Letters",
  lettersHint: "1–3 letters",
  lettersField: "Letters",
  emoji: "Emoji",
  own: "Your own emoji",
  ownPlaceholder: "Your own emoji, e.g. 🧮",
  use: "Use",
  oneEmoji: "Enter a single emoji.",
  quick: [
    ["more playful", "More playful"],
    ["more businesslike", "More businesslike"],
    ["letters", "Letters"],
    ["something else", "Something else"],
  ],
  failure: {
    model_unavailable: [
      "No model you are signed in to was found for suggestions.",
      "Sign in to a model service in Settings.",
    ],
    model_timeout: ["The model did not answer in time.", "You can try again."],
    model_invalid_response: [
      "No icon could be read from the model's answer.",
      "You can try again.",
    ],
    request_failed: ["No suggestions came.", "You can try again."],
  },
  rowLabel: "Icon suggestion",
  suggestion: "Suggestion",
  thinking: "The model is thinking…",
  reading: "The model is reading the workspace…",
  earlierKept: "The earlier suggestions are still here.",
  withoutModel: "Below are choices without a model.",
  openSettings: "Open settings",
  retry: "Try again",
  suggestions: "Suggestions:",
  notNow: "Not now",
  wishLabel: "Wish for the model",
  wishHint: "You can attach an image or text as a reference.",
  wishPlaceholder: "A wish, e.g. fox, blue, letters",
  suggest: "Suggest",
  previous: "Previous suggestions",
  next: "Next suggestions",
});
