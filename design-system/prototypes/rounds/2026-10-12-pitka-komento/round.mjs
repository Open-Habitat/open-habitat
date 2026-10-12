// Round 6 of 2026-10-12 (issue agent-turn-layout): how a long bash command is shown.
// Kept as the worked example of a round. Rivi was chosen and is now the library
// baseline (cmdRivi in lib/output.js, .cmd-* in lib/language.css); the other two
// directions live only in this directory.
export const title = 'Agentin vuoro · pitkä komento';
export const variants = [
  { name: 'Rivi', axis: 'ensimmäinen rivi, loput yhden hiljaisen napin takana', fn: 'v1' },
  { name: 'Lohko', axis: 'heredocin sisältö taittuu lohkona komennon sisällä', fn: 'v2' },
  { name: 'Sama laatikko', axis: 'komento saa saman laatikon kuin tuloste', fn: 'v3' },
];
