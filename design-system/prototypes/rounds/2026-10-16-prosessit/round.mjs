// Round of 2026-10-16 (issue proto-processes): the agent's background processes in the
// browser, modelled on the pi-processes extension Jari uses in the terminal. The same
// four processes, the same output with live follow and pausing, the same stop and the
// same lifecycle states in every direction; the directions differ in where the
// processes live relative to the conversation. "Tilanne" in the page bar switches the
// host state (empty, Pi stopped, terminal control, no extension, a stop that hangs).
export const title = 'Keskustelu · agentin prosessit';
export const app = true;
export const variants = [
  { name: 'Merkki yläpalkissa', axis: 'yläpalkin merkki kertoo käynnissä olevat; lista ponnahtaa merkistä ja tuloste avautuu omaan ikkunaansa keskustelun päälle', fn: 'v1' },
  { name: 'Sivupaneeli', axis: 'prosessit omana paneelinaan keskustelun vieressä: lista ylhäällä, valitun tuloste alla, keskustelu pysyy luettavana rinnalla', fn: 'v2' },
  { name: 'Kentän yllä', axis: 'prosessit keskustelun palstassa kirjoituskentän yllä tiiviinä rivinä, joka avautuu listaksi; tuloste avautuu rivin alle', fn: 'v3' },
];
