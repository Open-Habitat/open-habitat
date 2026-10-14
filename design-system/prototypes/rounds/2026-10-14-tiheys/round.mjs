// Round of 2026-10-14 (Jari's prototype queue, item 3): density of the
// conversation view. Jari found blocks and gaps too loose on pilot.59
// (issues/conversation-card-geometry/pilot59-spacing.png). The first direction is
// today's library as the reference; the others tighten in different ways.
export const title = 'Keskustelu · tiheys';
export const app = true;
export const variants = [
  { name: 'Nykyinen', axis: 'vertailukohta: kirjaston nykyiset välit', fn: 'v1' },
  { name: 'Kevyempi', axis: 'samat kortit, välit ja sisäreunat noin neljänneksen pienempiä', fn: 'v2' },
  { name: 'Tiivis', axis: 'välit puoleen, tekstikoko ja rivikorkeus pienempiä, matalammat rivit', fn: 'v3' },
  { name: 'Kortiton', axis: 'agentin vastaus ja työkalut ilman korttireunoja; tiheys syntyy rakenteesta', fn: 'v4' },
];
