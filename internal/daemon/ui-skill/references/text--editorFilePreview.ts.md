# text/editorFilePreview.ts

Generated from web/src/text/editorFilePreview.ts; do not edit.

```tsx
import { catalog, formatNumber, plural } from "../i18n";

// The editor's previews of a table, an SVG and an HTML page
// (components/EditorFilePreview.tsx).
const fi = {
  tableCaption: (
    rows: number,
    columns: number,
    separator: "semicolon" | "tab" | "comma",
    limit?: number,
  ) =>
    `${rows} riviä · ${columns} saraketta · erotin ${{ semicolon: "puolipiste", tab: "sarkain", comma: "pilkku" }[separator]}${limit ? ` · näytetään ${limit} ensimmäistä riviä` : ""}`,
  notSvg: "Kuvaa ei voi piirtää: tiedosto ei ole kelvollinen SVG.",
  checker: "läpinäkyvä tausta ruudukkona",
  inert:
    "Esikatselu ei suorita skriptejä eikä hae mitään verkosta. Linkit ja suhteelliset kuvat eivät toimi.",
};

export const editorFilePreviewText = catalog(fi, {
  tableCaption: (rows, columns, separator, limit) =>
    `${formatNumber(rows, undefined, "en")} ${plural("en", rows, { one: "row", other: "rows" })} · ${columns} ${plural("en", columns, { one: "column", other: "columns" })} · separator ${{ semicolon: "semicolon", tab: "tab", comma: "comma" }[separator]}${limit ? ` · showing the first ${formatNumber(limit, undefined, "en")} rows` : ""}`,
  notSvg: "The picture cannot be drawn: the file is not valid SVG.",
  checker: "transparent background as a checkerboard",
  inert:
    "The preview runs no scripts and fetches nothing from the network. Links and relative images do not work.",
});

```
