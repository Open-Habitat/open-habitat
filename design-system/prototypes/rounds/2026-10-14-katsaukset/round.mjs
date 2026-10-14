// Second riff of 2026-10-14, around "Kortit kertovat" (rounds/2026-10-14-tyotilat, v1):
// every conversation that needs the reader shows its Tilannekatsaus in full and
// verbatim; one that just finished and has no recap yet shows only its title.
// The directions differ in how recaps are grouped and laid out.
export const title = 'Etusivu · tilannekatsaukset';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Työtilakortit', axis: 'työtila on kortti, jonka sisällä sen katsaukset allekkain koko leveydellä', fn: 'v1' },
  { name: 'Työtilaosiot', axis: 'työtila on otsikko, katsaukset sen alla kahden palstan kortteina', fn: 'v2' },
  { name: 'Tilan mukaan', axis: 'katsaukset ryhmitelty tilan mukaan, työtila merkkinä kortissa', fn: 'v3' },
];
