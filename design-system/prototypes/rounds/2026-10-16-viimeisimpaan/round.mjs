// Round of 2026-10-16: the Viimeisimpään (jump to latest) button as a whole
// (proto-conversation-details). Production shows a round arrow button centred above the
// composer, or "Uutta sisältöä (n)" when content arrived; its visibility now follows height
// changes (latest-button-visibility). The directions differ in what the button tells about
// what is below and where it sits; when it shows and what it does are the same in all.
export const title = 'Keskustelu · Viimeisimpään-painike';
export const app = true;
export const variants = [
  { name: 'Nuoli', axis: 'pieni pyöreä nuoli palstan oikeassa alakulmassa; uudesta sisällöstä kertoo vain piste', fn: 'v1' },
  { name: 'Kertova', axis: 'pilleri keskellä kertoo, mitä alempana on: Pi työskentelee kelloineen, uusi vastaus tai pelkkä Viimeisimpään', fn: 'v2' },
  { name: 'Kentän reunassa', axis: 'kirjoituskentän yläreunaan kiinnittyvä kaista: tila vasemmalla, Viimeisimpään oikealla', fn: 'v3' },
];
