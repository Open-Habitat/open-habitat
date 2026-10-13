// Round of 2026-10-13 (Jari: "the ordinary text answer" and its code block, which looked
// wrong in live use). Production draws a fenced block as a figure with a bold "Koodi"
// band above and a separate "Kopioi koodi" button row below. The directions differ in how
// strongly a reply's structure (code, headings, tables, quotes) separates from the text.
export const title = 'Vastausteksti · koodilohko ja rakenne';
export const app = true;
export const variants = [
  { name: 'Hiljainen', axis: 'koodi on painettu paneeli, kieli ja kopiointi nurkassa', fn: 'v1' },
  { name: 'Otsakerivi', axis: 'koodilla on ohut otsake kuten työkalukortilla', fn: 'v2' },
  { name: 'Dokumentti', axis: 'väljä taitto, tumma koodi rivinumeroin, kuvateksti alla', fn: 'v3' },
];
