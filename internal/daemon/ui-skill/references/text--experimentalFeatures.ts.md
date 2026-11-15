# text/experimentalFeatures.ts

Generated from web/src/text/experimentalFeatures.ts; do not edit.

```tsx
import copy from "../../../internal/experimental/catalog.json";
import { altKey } from "../components/altKey";
import { catalog } from "../i18n";

// Settings › Kokeelliset ominaisuudet: the release catalog is also read by
// `open-habitat agent experimental list`; update <id> --on|--off changes the
// person's own saved choice. Read the command's result, not this reference,
// for the person's current switches.
const localized = (text: typeof copy.fi) => ({
  ...text,
  features: {
    ...text.features,
    "next-waiting-row": {
      ...text.features["next-waiting-row"],
      shows: text.features["next-waiting-row"].shows.replace(
        "{altDown}",
        altKey("↓"),
      ),
    },
  },
});

export const experimentalFeaturesText = catalog(
  localized(copy.fi),
  localized(copy.en),
);

```
