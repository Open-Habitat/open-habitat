# text/attachmentPreview.ts

Generated from web/src/text/attachmentPreview.ts; do not edit.

```tsx
import { catalog, formatNumber } from "../i18n";

// The dialog that shows an attachment or an offered file
// (components/AttachmentPreview.tsx).
const one = (n: number) =>
  formatNumber(n, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const fi = {
  size: (bytes: number) =>
    bytes < 1024
      ? `${bytes} t`
      : bytes < 1024 * 1024
        ? `${one(bytes / 1024)} kt`
        : `${one(bytes / 1024 / 1024)} Mt`,
  file: "Tiedosto",
  notUtf8: "Tiedosto ei ole UTF-8-tekstiä. Lataa se ja avaa omalla ohjelmalla.",
  type: "Tyyppi",
  sizeLabel: "Koko",
  counting: "Lasketaan…",
  unknown: "Ei tiedossa",
  close: "Sulje",
  moreInArchive: (n: number) =>
    `ja ${n} muuta tiedostoa. Yksittäistä tiedostoa ei voi avata paketista.`,
  notFromArchive: "Yksittäistä tiedostoa ei voi avata paketista.",
  opening: "Avataan esikatselua…",
  download: "Lataa",
  openOriginal: "Avaa alkuperäinen",
};

export const attachmentPreviewText = catalog(fi, {
  size: (bytes) =>
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${one(bytes / 1024)} KB`
        : `${one(bytes / 1024 / 1024)} MB`,
  file: "File",
  notUtf8:
    "The file is not UTF-8 text. Download it and open it in your own program.",
  type: "Type",
  sizeLabel: "Size",
  counting: "Counting…",
  unknown: "Unknown",
  close: "Close",
  moreInArchive: (n) =>
    `and ${n} other ${n === 1 ? "file" : "files"}. A single file cannot be opened from the archive.`,
  notFromArchive: "A single file cannot be opened from the archive.",
  opening: "Opening the preview…",
  download: "Download",
  openOriginal: "Open the original",
});

```
