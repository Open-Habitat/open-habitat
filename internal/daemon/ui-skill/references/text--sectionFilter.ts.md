# text/sectionFilter.ts

Generated from web/src/text/sectionFilter.ts; do not edit.

```tsx
import { catalog } from "../i18n";

const fi = {
  /** The count when one workspace is chosen: shown of all. */
  narrowed: (shown: number, all: number) => `${shown}/${all}, ${all} yhteensä`,
  /** The menus of Sinun vuorosi and Käynnissä. */
  menu: {
    yours: "Rajaa Sinun vuorosi -lista työtilan mukaan",
    running: "Rajaa Käynnissä-lista työtilan mukaan",
  },
  workspaces: "Työtilat",
  all: "Kaikki",
  done: "Valmis",
  notSaved: "Valintaa ei tallennettu. Yritä uudelleen.",
  /** Nothing of the chosen workspace in the section right now. */
  emptyNarrowed: (workspace: string) => `Ei mitään työtilasta ${workspace}.`,
  showAll: (count: number) => `Näytä kaikki (${count})`,
  kept: "avoinna, rajauksen ulkopuolelta",
};
export const sectionFilterText = catalog(fi, {
  narrowed: (shown, all) => `${shown}/${all}, ${all} in all`,
  menu: {
    yours: "Filter Your turn by workspace",
    running: "Filter Running by workspace",
  },
  workspaces: "Workspaces",
  all: "All",
  done: "Done",
  notSaved: "The choice was not saved. Try again.",
  emptyNarrowed: (workspace) => `Nothing from ${workspace}.`,
  showAll: (count) => `Show all (${count})`,
  kept: "open, outside the filter",
});

```
