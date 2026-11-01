# text/workspaceIconWrite.ts

Generated from web/src/text/workspaceIconWrite.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The workspace page's icon write (app/workspaceIconWrite.ts): refusals and
// what the commit did.
const fi = {
  refusals: {
    icon_invalid: "Kuvaketta ei tallennettu: arvo ei kelpaa kuvakkeeksi.",
    icon_config_unsupported:
      "Kuvaketta ei tallennettu: .open-habitat.yaml on muodossa, jota sivu ei osaa muokata rivi riviltä. Muokkaa icon-riviä itse.",
    workspace_busy:
      "Kuvaketta ei tallennettu: työtilassa on juuri toinen muutos kesken. Yritä hetken päästä uudelleen.",
    workspace_changed:
      "Kuvaketta ei tallennettu: työtila muuttui. Päivitä sivu ja yritä uudelleen.",
  } as Record<string, string>,
  commitNotes: {
    uncommitted:
      "Kuvake tallentui .open-habitat.yaml-tiedostoon, mutta sitä ei commitoitu, koska tiedostossa oli jo omia muutoksia.",
    commit_failed:
      "Kuvake tallentui .open-habitat.yaml-tiedostoon, mutta Git ei ottanut committia vastaan. Tiedosto odottaa commitia.",
  } as Record<string, string>,
  refused: "Kuvaketta ei tallennettu.",
  uncertain:
    "Kuvakkeen tallennusta ei voitu vahvistaa. Sivu lukee tilan uudelleen.",
};

export const workspaceIconWriteText = catalog(fi, {
  refusals: {
    icon_invalid: "The icon was not saved: the value is not a valid icon.",
    icon_config_unsupported:
      "The icon was not saved: .open-habitat.yaml is in a form the page cannot edit line by line. Edit the icon line yourself.",
    workspace_busy:
      "The icon was not saved: another change is under way in the workspace. Try again in a moment.",
    workspace_changed:
      "The icon was not saved: the workspace changed. Reload the page and try again.",
  },
  commitNotes: {
    uncommitted:
      "The icon was saved to .open-habitat.yaml but not committed, because the file already had changes of your own.",
    commit_failed:
      "The icon was saved to .open-habitat.yaml, but Git did not accept the commit. The file is waiting to be committed.",
  },
  refused: "The icon was not saved.",
  uncertain:
    "Saving the icon could not be confirmed. The page reads the state again.",
});

```
