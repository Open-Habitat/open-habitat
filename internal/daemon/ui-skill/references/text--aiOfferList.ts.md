# text/aiOfferList.ts

Generated from web/src/text/aiOfferList.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The onboarding AI step's options (components/AIOfferList.tsx), shared by
// the person's step and the administrator's preview.
const fi = {
  chatgpt: "ChatGPT-tilaus",
  chatgptHow: "Kirjaudu OpenAI-tililläsi. Käyttö kuuluu tilaukseesi.",
  claude: "Claude-tilaus",
  claudeHow: "Kirjaudu Claude-tililläsi. Käyttö kuuluu tilaukseesi.",
  apiKey: (provider: string) => `${provider} API-avain`,
  bills: (provider: string) => `${provider} laskuttaa käytöstä.`,
  suggests: (name: string) =>
    `Sivusto ehdottaa: ${name}. Voit lisätä muita tilejä myöhemmin kohdassa Asetukset › Tekoäly.`,
  chooseOne:
    "Valitse yksi tapa. Voit lisätä muita tilejä myöhemmin kohdassa Asetukset › Tekoäly.",
  suggestion: "Ehdotus",
  subscription: "Tilaus",
  keys: "API-avain · maksu käytön mukaan",
  others: "Käytä muuta AI-palvelua",
};

export const aiOfferListText = catalog(fi, {
  chatgpt: "ChatGPT subscription",
  chatgptHow:
    "Sign in with your OpenAI account. Use is part of your subscription.",
  claude: "Claude subscription",
  claudeHow:
    "Sign in with your Claude account. Use is part of your subscription.",
  apiKey: (provider) => `${provider} API key`,
  bills: (provider) => `${provider} bills for use.`,
  suggests: (name) =>
    `The site suggests: ${name}. You can add other accounts later under Settings › AI.`,
  chooseOne:
    "Choose one way. You can add other accounts later under Settings › AI.",
  suggestion: "Suggested",
  subscription: "Subscription",
  keys: "API key · pay per use",
  others: "Use another AI service",
});

```
