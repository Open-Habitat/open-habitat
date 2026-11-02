import { catalog } from "../i18n";

// The preview of a PDF, Word, spreadsheet or presentation attachment
// (components/DocumentPreview.tsx).
const fi = {
  failed:
    "Esikatselu ei onnistunut. Lataa tiedosto ja avaa se omalla ohjelmalla.",
  opening: "Avataan esikatselua…",
  pages: (shown: number, total: number) =>
    `Esikatselussa on ${shown} ensimmäistä sivua ${total} sivusta.`,
  page: (n: number) => `Sivu ${n}`,
  pageFailed: (n: number) =>
    `Sivua ${n} ei voitu näyttää. Lataa tiedosto ja avaa se omalla ohjelmalla.`,
  sheets: "Taulukot",
  truncated:
    "Taulukossa on enemmän rivejä tai sarakkeita kuin esikatselu näyttää.",
};

export const documentPreviewText = catalog(fi, {
  failed:
    "The preview did not work. Download the file and open it in your own program.",
  opening: "Opening the preview…",
  pages: (shown, total) =>
    `The preview shows the first ${shown} of ${total} pages.`,
  page: (n) => `Page ${n}`,
  pageFailed: (n) =>
    `Page ${n} could not be shown. Download the file and open it in your own program.`,
  sheets: "Sheets",
  truncated: "The sheet has more rows or columns than the preview shows.",
});
