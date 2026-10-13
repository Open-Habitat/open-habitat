// Round of 2026-10-13 from Jari's review of an old conversation on the test server: the
// separate "Malli vaihtui" and "Ajattelutaso vaihtui" markers say "changed" for the start
// state, look different from each other, and the copy action is a text button. The model
// and thinking level are one setting shown together; later changes and a compaction share
// one look. Common to all directions: the end-of-thread "Työ · N ajatusta · N työkalua"
// strip is gone and the summary sits in the thread head; Pi's session-name entries
// ("Keskustelun tieto · Quick Ping") are not shown, since the title is in the top bar.
// The directions differ in where the settings live.
export const title = 'Merkinnät · malli, ajattelutaso ja muutokset';
export const app = true;
export const variants = [
  { name: 'Alkurivi', axis: 'asetukset yhtenä rivinä keskustelun alussa, muutokset samanlaisina riveinä', fn: 'v1' },
  { name: 'Langan pää', axis: 'asetukset jokaisen Pi-vuoron päässä, muutos korostuu siinä vuorossa', fn: 'v2' },
  { name: 'Yläpalkki', axis: 'asetukset yläpalkissa, keskustelussa vain muutosviivat', fn: 'v3' },
];
