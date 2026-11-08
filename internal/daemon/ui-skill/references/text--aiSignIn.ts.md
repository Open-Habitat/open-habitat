# text/aiSignIn.ts

Generated from web/src/text/aiSignIn.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// An AI provider refusing the person's sign-in or key (app/AISignIn.tsx):
// the warning above the composer, the sign-in window, the failed turn's
// short row, the waiting message's line and the bell. Subscriptions are
// signed in again; a refused key is replaced.
type Service = {
  title: string;
  cause: string;
  short: string;
  fix: string;
  heading: string;
  done: string;
  bell: string;
};
const fi = {
  services: {
    "claude-bridge": {
      title: "Claude-kirjautuminen on vanhentunut",
      cause:
        "Claude ei enää hyväksy tilauksesi kirjautumista, eikä palvelin voi uusia sitä itse.",
      short: "Claude-keskustelut eivät vastaa ennen uutta kirjautumista.",
      fix: "Kirjaudu uudelleen",
      heading: "Kirjaudu Claudeen",
      done: "Claude-tilaus kirjautunut.",
      bell: "Claude poikki",
    },
    "openai-codex": {
      title: "ChatGPT-kirjautuminen on vanhentunut",
      cause:
        "OpenAI ei enää hyväksy ChatGPT-tilauksesi kirjautumista, eikä palvelin voi uusia sitä itse.",
      short: "ChatGPT-keskustelut eivät vastaa ennen uutta kirjautumista.",
      fix: "Kirjaudu uudelleen",
      heading: "Kirjaudu ChatGPT:hen",
      done: "ChatGPT-tilaus kirjautunut.",
      bell: "ChatGPT poikki",
    },
    openai: {
      title: "OpenAI hylkäsi API-avaimesi",
      cause:
        "Avain ei enää kelpaa: se on ehkä peruttu tai sen kiintiö on täynnä. Palvelin ei voi korjata sitä itse.",
      short: "OpenAI-avaimen keskustelut eivät vastaa ennen avaimen vaihtoa.",
      fix: "Vaihda avain",
      heading: "Vaihda OpenAI API-avain",
      done: "Uusi OpenAI-avain tallennettu.",
      bell: "OpenAI-avain",
    },
    anthropic: {
      title: "Anthropic hylkäsi API-avaimesi",
      cause:
        "Avain ei enää kelpaa: se on ehkä peruttu tai sen kiintiö on täynnä. Palvelin ei voi korjata sitä itse.",
      short:
        "Anthropic-avaimen keskustelut eivät vastaa ennen avaimen vaihtoa.",
      fix: "Vaihda avain",
      heading: "Vaihda Anthropic API-avain",
      done: "Uusi Anthropic-avain tallennettu.",
      bell: "Anthropic-avain",
    },
    deepseek: {
      title: "DeepSeek hylkäsi API-avaimesi",
      cause:
        "Avain ei enää kelpaa: se on ehkä peruttu tai sen kiintiö on täynnä. Palvelin ei voi korjata sitä itse.",
      short: "DeepSeek-avaimen keskustelut eivät vastaa ennen avaimen vaihtoa.",
      fix: "Vaihda avain",
      heading: "Vaihda DeepSeek API-avain",
      done: "Uusi DeepSeek-avain tallennettu.",
      bell: "DeepSeek-avain",
    },
  } satisfies Record<string, Service>,
  /** The failed turn, in one short row: the warning says the rest. */
  turn: (title: string) => `${title}. Viestiäsi ei käsitelty.`,
  waiting: "Odottaa kentässä · lähtee itse heti, kun olet kirjautunut.",
  waitingEdited:
    "Muokattu · lähtee itse tällaisenaan heti, kun olet kirjautunut.",
  waitingKey: "Odottaa kentässä · lähtee itse, kun uusi avain on tallessa.",
  waitingKeyEdited:
    "Muokattu · lähtee itse tällaisenaan, kun uusi avain on tallessa.",
  windowList: "Kun kirjautuminen on valmis, nämä viestit lähtevät heti:",
  windowListKey: "Kun uusi avain on tallessa, nämä viestit lähtevät heti:",
  windowNone: "Kentissä ei ole odottavia viestejä.",
  edited: "muokattu",
  goes: "lähtee",
  untitled: "Nimetön keskustelu",
  cancel: "Peruuta",
  sent: (done: string) => `${done} Viestisi lähti.`,
};

export const aiSignInText = catalog(fi, {
  services: {
    "claude-bridge": {
      title: "Your Claude sign-in has expired",
      cause:
        "Claude no longer accepts your subscription's sign-in, and the server cannot renew it by itself.",
      short: "Claude conversations do not answer until you sign in again.",
      fix: "Sign in again",
      heading: "Sign in to Claude",
      done: "Claude subscription signed in.",
      bell: "Claude down",
    },
    "openai-codex": {
      title: "Your ChatGPT sign-in has expired",
      cause:
        "OpenAI no longer accepts your ChatGPT subscription's sign-in, and the server cannot renew it by itself.",
      short: "ChatGPT conversations do not answer until you sign in again.",
      fix: "Sign in again",
      heading: "Sign in to ChatGPT",
      done: "ChatGPT subscription signed in.",
      bell: "ChatGPT down",
    },
    openai: {
      title: "OpenAI refused your API key",
      cause:
        "The key is no longer valid: it may have been revoked or its quota is used up. The server cannot fix it by itself.",
      short:
        "Conversations on the OpenAI key do not answer until it is changed.",
      fix: "Change key",
      heading: "Change OpenAI API key",
      done: "New OpenAI key saved.",
      bell: "OpenAI key",
    },
    anthropic: {
      title: "Anthropic refused your API key",
      cause:
        "The key is no longer valid: it may have been revoked or its quota is used up. The server cannot fix it by itself.",
      short:
        "Conversations on the Anthropic key do not answer until it is changed.",
      fix: "Change key",
      heading: "Change Anthropic API key",
      done: "New Anthropic key saved.",
      bell: "Anthropic key",
    },
    deepseek: {
      title: "DeepSeek refused your API key",
      cause:
        "The key is no longer valid: it may have been revoked or its quota is used up. The server cannot fix it by itself.",
      short:
        "Conversations on the DeepSeek key do not answer until it is changed.",
      fix: "Change key",
      heading: "Change DeepSeek API key",
      done: "New DeepSeek key saved.",
      bell: "DeepSeek key",
    },
  },
  turn: (title) => `${title}. Your message was not handled.`,
  waiting: "Waiting in the field · goes by itself as soon as you sign in.",
  waitingEdited: "Edited · goes by itself as it is now as soon as you sign in.",
  waitingKey: "Waiting in the field · goes by itself once a new key is saved.",
  waitingKeyEdited:
    "Edited · goes by itself as it is now once a new key is saved.",
  windowList: "Once you have signed in, these messages go at once:",
  windowListKey: "Once a new key is saved, these messages go at once:",
  windowNone: "No messages are waiting in the fields.",
  edited: "edited",
  goes: "goes",
  untitled: "Untitled conversation",
  cancel: "Cancel",
  sent: (done) => `${done} Your message went.`,
});

```
