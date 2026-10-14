// Riff of 2026-10-14 around the front-page round's "Työtilat" direction
// (rounds/2026-10-14-etusivu, v2): the home page is the workspace hub. The three
// directions differ in where waiting work shows and how far the list scales.
export const title = 'Etusivu · työtilat';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Kortit kertovat', axis: 'odottava työ korttien sisällä viimeisine riveineen, kortit huomion mukaan järjestyksessä', fn: 'v1' },
  { name: 'Työtilaluettelo', axis: 'työtila on rivi, joka avautuu; tiivis ja kymmeniin työtiloihin skaalautuva', fn: 'v2' },
  { name: 'Kaksi kerrosta', axis: 'odottavat omana kerroksenaan ylhäällä, työtilat pieninä laattoina alla', fn: 'v3' },
];
