// Round of 2026-10-16 (issue proto-composer-strip, topic 1): which way a new conversation
// fills after the first message. Jari: "Tuntuisi luontevammalta, että se lähtisi liikkeelle
// alalaidasta ja kasvaisi ylälaitaan kohden." Every direction plays the same story from an
// empty conversation: the first message is sent, Pi works (thinking, a test run, an edit,
// a second test run), writes a long reply, the conversation gets its title and a moment
// later the recap card appears above the field. "Jatkoviesti" in the page bar sends a
// second message, and the field works for your own. The directions differ only in where
// the conversation sits while it is shorter than the view.
export const title = 'Uusi keskustelu · täyttösuunta';
export const app = true;
export const variants = [
  { name: 'Ylhäältä', axis: 'nykyinen tuotanto: lanka alkaa näkymän ylälaidasta ja kasvaa alaspäin; kentän ja viimeisen viestin väliin jää tyhjää', fn: 'v1' },
  { name: 'Alhaalta', axis: 'chat-tyyli: lanka istuu kentän päällä ja kasvaa ylöspäin; tyhjä tila jää ylös, kunnes keskustelu täyttää näkymän', fn: 'v2' },
  { name: 'Viesti ylös', axis: 'lähetetty viesti nousee näkymän ylälaitaan ja vastaus kirjoittuu sen alle paikallaan pysyen; jokainen uusi viesti aloittaa oman näkymänsä', fn: 'v3' },
];
