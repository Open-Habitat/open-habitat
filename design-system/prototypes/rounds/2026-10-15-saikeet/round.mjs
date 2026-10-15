// Riff of 2026-10-15 on Jari's own description after the "blokkien avaus" round:
// threads (a Pi turn's work) are closed by default and open one at a time; a thread
// the reader closes stays closed; the default can be changed. In an open or live
// thread, the streaming block is open and closes when it finishes, the next one
// opening in its place. When the turn ends its thread closes by the default.
export const title = 'Keskustelu · säikeet kiinni';
export const app = true;
// The round draws its own quiet work; lib/quiet.* has the chosen version since 15.10.
export const quiet = false;
export const variants = [
  { name: 'Säikeet kiinni', axis: 'säie oletuksena kiinni; käynnissä oleva blokki auki, valmis kiinni', fn: 'v1' },
];
