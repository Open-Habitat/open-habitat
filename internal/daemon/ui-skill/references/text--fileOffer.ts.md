# text/fileOffer.ts

Generated from web/src/text/fileOffer.ts; do not edit.

```tsx
import type { FileKind } from "../app/fileOffers";
import { catalog, plural } from "../i18n";

export type KindText = {
  /** What the second button gives; none for a kind the browser cannot show. */
  action?: string;
  type: (ext: string) => string;
};

// Files an agent offered (components/FileOffer.tsx): the card in the
// conversation and the conversation's file panel.
const fi = {
  kinds: {
    image: { action: "Näytä isona", type: (e: string) => `${e}-kuva` },
    svg: { action: "Näytä isona", type: (_e: string) => "SVG-kuva" },
    video: { action: "Toista", type: (e: string) => `Video (${e})` },
    audio: { action: "Kuuntele", type: (e: string) => `Ääni (${e})` },
    markdown: { action: "Lue", type: (_e: string) => "Markdown" },
    pdf: { action: "Esikatsele", type: (_e: string) => "PDF-asiakirja" },
    docx: { action: "Esikatsele", type: (_e: string) => "Word-asiakirja" },
    pptx: {
      action: "Selaa dioja",
      type: (_e: string) => "PowerPoint-esitys",
    },
    xlsx: {
      action: "Näytä taulukko",
      type: (_e: string) => "Excel-taulukko",
    },
    csv: { action: "Näytä taulukko", type: (e: string) => `${e}-taulukko` },
    code: { action: "Näytä koodi", type: (e: string) => `${e}-koodi` },
    text: { action: "Lue", type: (e: string) => `Teksti (${e})` },
    zip: { action: "Näytä sisältö", type: (_e: string) => "Zip-paketti" },
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
  folders: (n: number) => (n === 1 ? "1 kansio" : `${n} kansiota`),
  unpacked: (size: string) => `purettuna ${size}`,
  at: (time: string) => `klo ${time}`,
  download: "Lataa",
  offered: "Agentti tarjosi ladattavaksi:",
  offersFolder: "Agentti tarjoaa ladattavaksi kansion:",
  offers: "Agentti tarjoaa ladattavaksi:",
  label: (title: string) => `Agentin tarjoama tiedosto: ${title}`,
  removed: "Poistettu. Tiedosto ei ole enää ladattavissa.",
  onlyYou: "Vain sinulle",
  unavailable: "Tiedoston tietoja ei saatu juuri nyt. Lataa sivu uudelleen.",
  showLarge: (name: string) => `Näytä isona: ${name}`,
  cannotShow: (ext: string) =>
    ext
      ? `Selain ei osaa näyttää .${ext}-tiedostoa. Lataa se ja avaa omalla ohjelmallasi.`
      : "Selain ei osaa näyttää tätä tiedostoa. Lataa se ja avaa omalla ohjelmallasi.",
  downloadAll: "Lataa kaikki (.zip)",
  showFiles: "Näytä tiedostot",
  shelf: "Keskustelun tiedostot",
  shelfTitle: "Tiedostot",
  closeShelf: "Sulje tiedostot",
  search: "Etsi kaikista tarjouksista",
  shelfUnavailable: "Tiedostoja ei saatu juuri nyt.",
  shelfEmpty: "Tässä keskustelussa ei ole tarjottuja tiedostoja.",
  zipAll: (title: string) => `Lataa kaikki zipinä: ${title}`,
  removedShort: "Poistettu.",
  loading: "Ladataan…",
  factsUnavailable: "Tietoja ei saatu juuri nyt.",
  downloadNamed: (name: string) => `Lataa: ${name}`,
};

export const fileOfferText = catalog(fi, {
  kinds: {
    image: { action: "View large", type: (e) => `${e} image` },
    svg: { action: "View large", type: () => "SVG image" },
    video: { action: "Play", type: (e) => `Video (${e})` },
    audio: { action: "Listen", type: (e) => `Audio (${e})` },
    markdown: { action: "Read", type: () => "Markdown" },
    pdf: { action: "Preview", type: () => "PDF document" },
    docx: { action: "Preview", type: () => "Word document" },
    pptx: { action: "Browse slides", type: () => "PowerPoint presentation" },
    xlsx: { action: "View spreadsheet", type: () => "Excel spreadsheet" },
    csv: { action: "View table", type: (e) => `${e} table` },
    code: { action: "View code", type: (e) => `${e} code` },
    text: { action: "Read", type: (e) => `Text (${e})` },
    zip: { action: "View contents", type: () => "Zip archive" },
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
  folders: (n) =>
    `${n} ${plural("en", n, { one: "folder", other: "folders" })}`,
  unpacked: (size) => `${size} unpacked`,
  at: (time) => `at ${time}`,
  download: "Download",
  offered: "The agent offered for download:",
  offersFolder: "The agent offers a folder for download:",
  offers: "The agent offers for download:",
  label: (title) => `File offered by the agent: ${title}`,
  removed: "Removed. The file can no longer be downloaded.",
  onlyYou: "Only for you",
  unavailable:
    "The file's details could not be fetched just now. Reload the page.",
  showLarge: (name) => `View large: ${name}`,
  cannotShow: (ext) =>
    `The browser cannot show ${ext ? `a .${ext} file` : "this file"}. Download it and open it with your own app.`,
  downloadAll: "Download all (.zip)",
  showFiles: "Show files",
  shelf: "Conversation files",
  shelfTitle: "Files",
  closeShelf: "Close files",
  search: "Search all offers",
  shelfUnavailable: "The files could not be fetched just now.",
  shelfEmpty: "No files have been offered in this conversation.",
  zipAll: (title) => `Download all as a zip: ${title}`,
  removedShort: "Removed.",
  loading: "Loading…",
  factsUnavailable: "The details could not be fetched just now.",
  downloadNamed: (name) => `Download: ${name}`,
});

```
