// Round 2 of 2026-10-13 (issue conversation-actions-layout): the bottom of the
// conversation — the field, send as an icon, stop, steer versus after-the-turn
// queue, and no keyboard hint row. The directions differ in where stop lives
// and how the working-time choice between steering and queueing is made.
export const title = 'Keskustelun alakerta · kenttä, Lähetä ja Stop';
export const app = true;
export const variants = [
  { name: 'Työkalurivi', axis: 'kentän alareunan rivi: Stop vasemmalla, tapa ja Lähetä oikealla', fn: 'v1' },
  { name: 'Lähetä-paikka', axis: 'yksi painike vaihtaa: Lähetä tai Stop samassa kohdassa', fn: 'v2' },
  { name: 'Tilarivi', axis: 'työn tila ja Stop kentän yläpuolella, Ohjaa ja Jonoon kentän vieressä', fn: 'v3' },
];
