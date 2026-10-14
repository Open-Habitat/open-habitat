// Round of 2026-10-14 (Jari's prototype queue, item 1): the home page (Etusivu)
// that the sidebar's Etusivu row opens. The sidebar, top bar and conversation
// view are the chosen library ones; the round draws the home page on the stage.
export const title = 'Etusivu';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Huomiolista', axis: 'sinua odottavat keskustelut ensin, koko leveydellä esikatseluineen', fn: 'v1' },
  { name: 'Työtilat', axis: 'työtilat kortteina, kussakin avoin työ ja uuden aloitus', fn: 'v2' },
  { name: 'Aloita työ', axis: 'uuden työn aloitus kenttänä ensin, odottavat sen alla', fn: 'v3' },
];
