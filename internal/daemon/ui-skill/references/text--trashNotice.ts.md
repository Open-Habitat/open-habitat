# text/trashNotice.ts

Generated from web/src/text/trashNotice.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The notice after a workspace deletion (app/TrashNotice.tsx). Names,
// remotes, paths and process names come in as arguments.
const fi = {
  kept: {
    changed_after_check:
      "se muuttui tarkistuksen jälkeen, joten se jäi roskakoriin",
    process_inside: "prosessi käytti sitä, joten se jäi roskakoriin",
    fetch_failed: "etärepoa ei voitu hakea, joten se jäi roskakoriin",
  },
  deleted: "Poistettu pysyvästi",
  cloneBack: (remote: string) => `Sen saa takaisin kloonaamalla ${remote}.`,
  partial: "osa jäi roskakoriin; poista se sieltä uudelleen",
  replaced: (entry: string) =>
    `roskakoriin siirtyi eri hakemisto (${entry}); palauta se sieltä`,
  stillInside: (process: string) => `${process} on yhä sen hakemistossa`,
  trashed: "Siirretty roskakoriin",
  notDeleted: "Ei poistettu kokonaan:",
};

export const trashNoticeText = catalog(fi, {
  kept: {
    changed_after_check:
      "it changed after the check, so it stayed in the Trash",
    process_inside: "a process was using it, so it stayed in the Trash",
    fetch_failed: "the remote could not be fetched, so it stayed in the Trash",
  },
  deleted: "Deleted permanently",
  cloneBack: (remote) => `You can get it back by cloning ${remote}.`,
  partial: "part of it stayed in the Trash; delete it there again",
  replaced: (entry) =>
    `a different directory (${entry}) went to the Trash; restore it from there`,
  stillInside: (process) => `${process} is still in its directory`,
  trashed: "Moved to the Trash",
  notDeleted: "Not fully deleted:",
});

```
