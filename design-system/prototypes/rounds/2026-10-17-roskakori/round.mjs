// Työtilan poisto ja roskakori (proto-trash-and-devices, 17.10.2026). ADR 0019 ja Jarin
// lisäys issuessa implement-workspace-trash: puhdas, kokonaan pushattu Git-repo poistetaan
// heti pysyvästi, muu siirtyy freedesktop-roskakoriin, josta sen voi palauttaa tai poistaa
// pysyvästi nimen kirjoittamalla. Poistovahvistus, estot ja pysyvä poisto ovat samat
// kaikissa suunnissa; suunnat eroavat vain siinä, missä roskakori asuu.
export const title = 'Työtilan poisto ja roskakori';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Oma sivu', axis: 'roskakori on oma sivunsa, jonka rivi on sivupalkin alareunassa tilipainikkeen yläpuolella lukumäärän kanssa', fn: 'v1' },
  { name: 'Työtilojen joukossa', axis: 'roskakorissa olevat työtilat ovat sivupalkin lopussa taitettuna Roskakori-ryhmänä; rivi avaa työtilan sivun roskakoritilassa, jossa Palauta ja Poista pysyvästi', fn: 'v2' },
  { name: 'Tallennustilassa', axis: 'roskakori on tallennustilan asia: Asetukset › Tallennustila näyttää sen osuuden käytöstä ja listan; sivupalkissa ei ole mitään', fn: 'v3' },
];
