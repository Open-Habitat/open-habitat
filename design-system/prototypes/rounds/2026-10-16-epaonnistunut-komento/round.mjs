// Round of 2026-10-16: what a failed bash card looks like (proto-conversation-details).
// Jari, pilot.65: the failed card repeated its failure as a notice; that was removed
// (tool-failure-notice), and the look itself was left for this round. Production now tints
// the whole card red. Pi marks a failed tool result only with `isError`; for bash it ends
// the text with its own status line ("Command exited with code 2", "Command timed out
// after 30 seconds"). The directions differ in how loud the card is and how much it says
// about the cause; the conversation, the failures and the rest of the card are the same.
export const title = 'Keskustelu · epäonnistunut komento';
export const app = true;
export const variants = [
  { name: 'Kulma', axis: 'kortti kuten onnistunut; vain kulma ja langan solmu kertovat epäonnistumisen, Pi:n tilarivi jää tulosteeseen', fn: 'v1' },
  { name: 'Syy kulmassa', axis: 'kulma kertoo syyn (paluuarvo, aikakatkaisu), Pi:n tilarivi lähtee tulosteesta; kortin vasen reuna punainen', fn: 'v2' },
  { name: 'Viimeinen rivi', axis: 'kuten Syy kulmassa, ja suljettu kortti näyttää tulosteen viimeisen rivin otsakkeen alla', fn: 'v3' },
];
