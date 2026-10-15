// Riff of 2026-10-15 on "hiljainen työ" (Jari accepted it): how the
// "Agentti työskentelee" information row shows that it can be clicked to see the work.
export const title = 'Keskustelu · inforivin painettavuus';
export const app = true;
// The round draws its own quiet work; lib/quiet.* has the chosen version since 15.10.
export const quiet = false;
export const variants = [
  { name: 'Väkänen edessä', axis: 'koko rivi on painike: väkänen alussa, korostus osoitettaessa', fn: 'v1' },
  { name: 'Näytä työ -painike', axis: 'rivi kertoo tilan, oikealla erillinen pieni painike "Näytä työ"', fn: 'v2' },
  { name: 'Vaihekortti', axis: 'rivi on kortti, jossa vaiheiden määrä kasvaa ja "Näytä vaiheet ›"', fn: 'v3' },
];
