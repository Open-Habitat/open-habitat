// Round of 2026-10-13 (issue recap-above-composer): the "Tilannekatsaus" card
// above the composer — dismissable until a newer recap exists, its age and a
// stale mark in the header, manual refresh and automatic generation after
// three idle minutes. The directions differ in how much room the card takes
// and how it joins the field.
export const title = 'Tilannekatsaus · kentän yllä';
export const app = true;
export const recap = false; // draws its own recap
export const variants = [
  { name: 'Kortti', axis: 'koko katsaus omana korttinaan kentän yllä', fn: 'v1' },
  { name: 'Rivi', axis: 'yksi rivi, josta katsauksen saa auki', fn: 'v2' },
  { name: 'Kentän kansi', axis: 'katsaus kiinni kentän yläreunassa, ehdotus siirtyy kenttään', fn: 'v3' },
];
