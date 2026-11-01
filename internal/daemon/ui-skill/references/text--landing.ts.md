# text/landing.ts

Generated from web/src/text/landing.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// public/landing-bootstrap.js paints `connecting` and `slow` before the
// bundle runs; keep its copies the same.
const fi = {
  connecting: "Yhdistetään palvelimeen…",
  greeting: (name: string) => `Hei ${name}. Haetaan työtilojasi…`,
  slow: "Palvelin vastaa tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki.",
  failedTitle: "Työtiloja ei saatu näkyviin",
  failedDetail:
    "Palvelin ei vastannut. Tämä ei tarkoita, että työtilasi olisivat kadonneet.",
  retry: "Yritä uudelleen",
};

export const landingText = catalog(fi, {
  connecting: "Connecting to the server…",
  greeting: (name) => `Hi ${name}. Fetching your workspaces…`,
  slow: "The server is answering more slowly than usual. Still waiting; you can leave the page open.",
  failedTitle: "Your workspaces could not be shown",
  failedDetail:
    "The server did not answer. This does not mean your workspaces are gone.",
  retry: "Try again",
});

```
