// Round of 2026-10-16: the floating notice after archiving (proto-conversation-details).
// Jari, pilot.59: archiving needs no confirmation and the window moves to the workspace
// view; a floating "Arkistoitu" notice with Palauta replaces the confirmation's safety
// (archive-without-confirmation). Production archives directly and shows no notice yet.
// The directions differ in how long Palauta floats and where the way back continues.
export const title = 'Keskustelu · arkistoinnin ilmoitus';
export const app = true;
export const variants = [
  { name: 'Hetki alhaalla', axis: 'tumma ilmoitus alareunassa kahdeksan sekuntia (pysähtyy osoittimen tai fokuksen alla); sen jälkeen paluu on Arkisto-osiossa', fn: 'v1' },
  { name: 'Kortti ylhäällä', axis: 'vaalea kortti yläkulmassa arkistointipainikkeen kohdalla; pysyy, kunnes suljet sen tai siirryt muualle', fn: 'v2' },
  { name: 'Arkistoon', axis: 'kuten Hetki alhaalla, mutta poistuessaan ilmoitus siirtyy Arkisto-osion riville, joka jää korostetuksi', fn: 'v3' },
];
