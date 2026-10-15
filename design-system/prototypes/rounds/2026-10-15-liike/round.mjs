// Round of 2026-10-15: motion for blocks and threads that close, open and arrive, on
// top of the chosen "säikeet kiinni" behaviour (rounds/2026-10-15-saikeet). Jari:
// closing should read as "this closes, this closes", and a new block should arrive
// with a small animation. "Hidastettu" in the page bar slows the motion threefold.
export const title = 'Keskustelu · liike';
export const app = true;
export const variants = [
  { name: 'Liuku', axis: 'korkeus liukuu kiinni ja auki; uusi blokki nousee esiin', fn: 'v1' },
  { name: 'Kuittaus', axis: 'sulkeutuessa otsake välähtää ja valmis-merkki ponnahtaa; uusi kasvaa korkeudesta', fn: 'v2' },
  { name: 'Haalistuu', axis: 'sisältö haalistuu ensin, sitten tila kutistuu; uusi liukuu sivulta', fn: 'v3' },
];
