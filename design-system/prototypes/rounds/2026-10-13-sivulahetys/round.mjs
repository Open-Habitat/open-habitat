// Round of 2026-10-13 (issue conversation-actions-layout): send back beside the
// one-line field that grows to a maximum and then scrolls; stop and the
// steer/after-the-turn pill appear only while Pi works, and the directions
// differ in where they appear.
export const title = 'Alakerta · Lähetä sivussa, Stop työn ajan';
export const app = true;
export const variants = [
  { name: 'Kentän alla', axis: 'työn ajan rivi kentän alla: Stop vasemmalla, pilleri oikealla', fn: 'v1' },
  { name: 'Kentän yllä', axis: 'sama rivi kentän yläpuolella', fn: 'v2' },
  { name: 'Sivussa', axis: 'Stop Lähetä-painikkeen yllä sivussa, pilleri kentän alla', fn: 'v3' },
];
