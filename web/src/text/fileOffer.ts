import type { FileKind } from "../app/fileOffers";
import { catalog, plural } from "../i18n";

export type KindText = {
  type: (ext: string) => string;
};

// Files an agent offered (components/FileOffer.tsx): what a file is, its
// facts and sizes, on the offer card, in the list and in the panel.
const fi = {
  kinds: {
    image: { type: (e: string) => `${e}-kuva` },
    svg: { type: (_e: string) => "SVG-kuva" },
    video: { type: (e: string) => `Video (${e})` },
    audio: { type: (e: string) => `Ääni (${e})` },
    markdown: { type: (_e: string) => "Markdown" },
    pdf: { type: (_e: string) => "PDF-asiakirja" },
    docx: { type: (_e: string) => "Word-asiakirja" },
    pptx: {
      type: (_e: string) => "PowerPoint-esitys",
    },
    xlsx: {
      type: (_e: string) => "Excel-taulukko",
    },
    csv: { type: (e: string) => `${e}-taulukko` },
    code: { type: (e: string) => `${e}-koodi` },
    text: { type: (e: string) => `Teksti (${e})` },
    zip: { type: (_e: string) => "Zip-paketti" },
    file: { type: (_e: string) => "Tuntematon tyyppi" },
  } satisfies Record<FileKind, KindText>,
  bytes: (n: number) => `${n} t`,
  kilobytes: (n: number) => `${n} kt`,
  megabytes: (n: string) => `${n} Mt`,
  gigabytes: (n: string) => `${n} Gt`,
  rows: (n: string) => `${n} riviä`,
  columns: (n: string) => `${n} saraketta`,
  files: (n: number, shown: string) =>
    n === 1 ? "1 tiedosto" : `${shown} tiedostoa`,
  unpacked: (size: string) => `purettuna ${size}`,
  label: (title: string) => `Agentin tarjoama tiedosto: ${title}`,
  cannotShow: (ext: string) =>
    ext
      ? `Selain ei osaa näyttää .${ext}-tiedostoa. Lataa se ja avaa omalla ohjelmallasi.`
      : "Selain ei osaa näyttää tätä tiedostoa. Lataa se ja avaa omalla ohjelmallasi.",
};

export const fileOfferText = catalog(fi, {
  kinds: {
    image: { type: (e) => `${e} image` },
    svg: { type: () => "SVG image" },
    video: { type: (e) => `Video (${e})` },
    audio: { type: (e) => `Audio (${e})` },
    markdown: { type: () => "Markdown" },
    pdf: { type: () => "PDF document" },
    docx: { type: () => "Word document" },
    pptx: { type: () => "PowerPoint presentation" },
    xlsx: { type: () => "Excel spreadsheet" },
    csv: { type: (e) => `${e} table` },
    code: { type: (e) => `${e} code` },
    text: { type: (e) => `Text (${e})` },
    zip: { type: () => "Zip archive" },
    file: { type: () => "Unknown type" },
  },
  bytes: (n) => `${n} B`,
  kilobytes: (n) => `${n} KB`,
  megabytes: (n) => `${n} MB`,
  gigabytes: (n) => `${n} GB`,
  rows: (n) => `${n} ${n === "1" ? "row" : "rows"}`,
  columns: (n) => `${n} ${n === "1" ? "column" : "columns"}`,
  files: (n, shown) =>
    `${shown} ${plural("en", n, { one: "file", other: "files" })}`,
  unpacked: (size) => `${size} unpacked`,
  label: (title) => `File offered by the agent: ${title}`,
  cannotShow: (ext) =>
    `The browser cannot show ${ext ? `a .${ext} file` : "this file"}. Download it and open it with your own app.`,
});
