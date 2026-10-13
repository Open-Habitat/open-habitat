// The chosen conversation view as one direction: the library's baseline, frozen as
// ../drafts/Agentin vuoro.proto.html. Since 2026-10-13 the turn sits in the chosen
// application frame (sidebar, top bar with icon actions). Rebuild after a round
// moves the baseline:
//   node build.mjs agentin-vuoro --out "../drafts/Agentin vuoro.proto.html"
export const title = 'Agentin vuoro · valittu vedos';
export const app = true;
export const variants = [{ name: 'Valittu', axis: 'agentin vuoro 12.10., yläpalkki 13.10.', fn: 'chosen' }];
