// Round of 2026-10-13 (issue conversation-actions-layout): the sidebar's
// conversation rows — what a row tells and how a workspace's rows are ordered
// once there are many. The top bar, composer and recap are the chosen ones.
export const title = 'Sivupalkki · keskustelurivit';
export const app = true;
export const variants = [
  { name: 'Merkki oikealla', axis: 'otsikko ja tilamerkki oikeassa reunassa, kaikki rivit', fn: 'v1' },
  { name: 'Merkki ja aika', axis: 'tilamerkki rivin alussa, viimeisin toiminta oikealla', fn: 'v2' },
  { name: 'Huomio ensin', axis: 'sinua odottavat ja käynnissä olevat ensin, valmiit taitettuna', fn: 'v3' },
];
