// Riff of 2026-10-13 on the output box (bash output and reply code, Ikkuna). Jari asked
// for three things: long lines that now need much sideways scrolling, controls grouped so
// that it is clear what each does, and honest state: "Alkuun" must not stay pressed after
// the reader scrolls away. All directions model jumps as actions (disabled or hidden at
// that end) and only the view as a pressed state. They differ in where the controls live.
export const title = 'Laatikko · pitkät rivit, painikkeet ja tila';
export const app = true;
export const variants = [
  { name: 'Ryhmät', axis: 'sivupalkki ryhminä: kopioi · näkymä · hypyt · rivitys ja ikkuna', fn: 'v1' },
  { name: 'Palkki', axis: 'nimetyt painikkeet laatikon alla, rivitys oletuksena, ei sisävieritystä', fn: 'v2' },
  { name: 'Valikko', axis: 'yksi näkymävalikko, hypyt laatikon sisällä vain kun niillä on suunta', fn: 'v3' },
];
