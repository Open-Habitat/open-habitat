// Round of 2026-10-14 (Jari's prototype queue, item 2): the left sidebar's own
// controls. Server administration moves out of the odd inline link into a menu,
// and workspace management (new workspace, per-workspace actions) gets a home in
// the sidebar. The directions differ in where the account and server live.
export const title = 'Vasen palkki · tili ja työtilat';
export const app = true;
export const variants = [
  { name: 'Tilivalikko alhaalla', axis: 'tili ja ylläpito yhdessä valikossa palkin alareunassa', fn: 'v1' },
  { name: 'Palvelin ylhäällä', axis: 'palvelin ja sen ylläpito ylhäällä, oma tili alhaalla', fn: 'v2' },
  { name: 'Kaikki ylhäällä', axis: 'tili, haku ja uusi työtila kuvakkeina palkin yläreunassa', fn: 'v3' },
];
