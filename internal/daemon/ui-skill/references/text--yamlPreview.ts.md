# text/yamlPreview.ts

Generated from web/src/text/yamlPreview.ts; do not edit.

```tsx
import { catalog } from "../i18n";

const fi = {
  empty: "tyhjä",
  noItems: "ei kohtia",
  label: "YAML-esikatselu",
  jsonLabel: "JSON-esikatselu",
  invalidJson: "JSON ei ole kelvollista. Näytetään lähde.",
  invalid: (line?: number) =>
    line
      ? `YAML ei ole kelvollista rivillä ${line}. Näytetään lähde.`
      : "YAML ei ole kelvollista. Näytetään lähde.",
  unsupported: "Tätä rakennetta ei voi näyttää esikatseluna. Näytetään lähde.",
};
export const yamlPreviewText = catalog(fi, {
  empty: "empty",
  noItems: "no items",
  label: "YAML preview",
  jsonLabel: "JSON preview",
  invalidJson: "Invalid JSON. Showing the source.",
  invalid: (line) =>
    line
      ? `Invalid YAML on line ${line}. Showing the source.`
      : "Invalid YAML. Showing the source.",
  unsupported: "This structure cannot be previewed. Showing the source.",
});

```
