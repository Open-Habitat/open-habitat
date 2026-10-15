// Second riff of 2026-10-15 around "Näytä työ -painike" (rounds/2026-10-15-inforivi, v2):
// Jari likes the button but finds it hidden at the far right. Where it sits instead.
export const title = 'Keskustelu · Näytä työ -painikkeen paikka';
export const app = true;
export const variants = [
  { name: 'Tekstin perässä', axis: 'painike heti tilatekstin jälkeen, kello oikealla', fn: 'v1' },
  { name: 'Rivin alussa', axis: 'painike rivin alussa ennen tilatekstiä', fn: 'v2' },
  { name: 'Oma rivi alla', axis: 'tila ylärivillä, painike vaiheiden määrän kanssa sen alla vasemmalla', fn: 'v3' },
];
