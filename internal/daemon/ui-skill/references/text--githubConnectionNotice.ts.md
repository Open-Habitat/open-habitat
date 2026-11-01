# text/githubConnectionNotice.ts

Generated from web/src/text/githubConnectionNotice.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The GitHub connection in a conversation's warning and where GitHub is
// needed (app/GitHubConnectionNotice.tsx). The warnings themselves are in
// github.ts.
const fi = {
  reconnected: (login?: string) =>
    `GitHub yhdistetty${login ? ` käyttäjänä ${login}` : ""}. Pyydä agenttia yrittämään uudelleen.`,
  returned: "GitHub-yhteys palasi.",
  verifying: "GitHub hylkäsi valtuutuksen · tarkistetaan uudelleen…",
  retrying: (attempt: number, attempts: number) =>
    `GitHub ei vastannut · yritetään uudelleen… (${attempt}/${attempts})`,
  placeTitle: "GitHub-yhteyttä ei voitu käyttää",
  placeText:
    "Palvelin ei juuri nyt saanut GitHubista vastausta tunnuksillasi. Se tarkistaa yhteyden uudelleen itse; yritä hetken päästä.",
};

export const githubConnectionNoticeText = catalog(
  fi,
  {
    reconnected: (login) =>
      `GitHub connected${login ? ` as ${login}` : ""}. Ask the agent to try again.`,
    returned: "The GitHub connection is back.",
    verifying: "GitHub rejected the authorization · checking again…",
    retrying: (attempt, attempts) =>
      `GitHub did not answer · trying again… (${attempt}/${attempts})`,
    placeTitle: "The GitHub connection could not be used",
    placeText:
      "The server did not get an answer from GitHub with your credentials just now. It checks the connection again by itself; try again in a moment.",
  },
  { verifying: "GitHub rejected the authorisation · checking again…" },
);

```
