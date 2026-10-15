// Round of 2026-10-15 (Jari's prototype queue): Asetukset and Palvelimen ylläpito.
// Jari: the current ones are bad and must be made again; the prototyper looks at the
// current views and redesigns them. Content is the current one (account, Git
// identity, GitHub and Pi connections with the default model, agent work, theme,
// own storage; server name, users and roles, storage limits) plus the API key
// Jari asked for the same day. The directions differ in how it is organised.
// KESKEN 15.10. illalla: `themeSeg` on account.js:n sisäinen (ReferenceError), ja
// Palvelimen ylläpito -valikkokohta ei löytynyt testiskriptissä; kierros ei ole
// vielä tarkistettu eikä näytetty Jarille. Yön prototyyppiworker viimeistelee.
export const title = 'Asetukset ja palvelimen ylläpito';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Yksi sivu', axis: 'kaikki yhdellä vieritettävällä sivulla, osioluettelo sivussa; ylläpito samalla sivulla ylläpitäjälle', fn: 'v1' },
  { name: 'Osiot', axis: 'osioluettelo ja yksi osio kerrallaan, kuten käyttöjärjestelmän asetukset; ylläpito omana ryhmänään', fn: 'v2' },
  { name: 'Kaksi näkymää', axis: 'omat asetukset tiiviinä listana; palvelimen ylläpito erillisenä kojelautana', fn: 'v3' },
];
