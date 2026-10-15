// Round of 2026-10-15: how the "Näytä työ" button at the start of the information
// row behaves (position chosen: rivin alussa, rounds/2026-10-15-inforivi-2 v2). Jari
// found the transition clunky. The directions differ in what moves when the work
// opens or closes. "Hidastettu" in the page bar slows the motion threefold.
export const title = 'Keskustelu · Näytä työ -painikkeen käytös';
export const app = true;
// The round draws its own quiet work; lib/quiet.* has the chosen version since 15.10.
export const quiet = false;
export const variants = [
  { name: 'Liukuu auki', axis: 'työ liukuu auki ja kiinni painikkeen yläpuolelle; painike seuraa', fn: 'v1' },
  { name: 'Painike paikallaan', axis: 'painike pysyy osoittimen alla; työ ilmestyy yläpuolelle ilman liikettä', fn: 'v2' },
  { name: 'Porrastettu', axis: 'painike paikallaan, vaiheet ilmestyvät porrastetusti yksi kerrallaan', fn: 'v3' },
];
