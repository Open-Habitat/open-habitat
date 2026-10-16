// Round of 2026-10-16 (proto-loading-landing): the loading landing from the first paint
// until the home page appears. Jari (lataus-nyt.png): "Tää vaatii hiomista. Haluan, että
// tää landeri näyttäisi kivemmalta." Axis: what the wait shows. The page bar's Lataus
// select plays a slow, fast, very slow or failing load; R replays it. The fourth entry
// is today's production loader for comparison. The home page is the chosen Etusivu
// (copied from ../../etusivu).
export const title = 'Latausnäkymä';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Merkki', axis: 'tuotteen merkki keskellä ilman kehystä; yksi rivi kertoo, mitä odotetaan; kehys ja etusivu tulevat kerralla', fn: 'v1' },
  { name: 'Runko', axis: 'sovelluksen kehys heti ja etusivun muotoiset luonnokset paikoillaan; sisältö täyttyy niihin', fn: 'v2' },
  { name: 'Vaiheet', axis: 'kehys ja etusivun otsikko heti; sen alla hostin todelliset vaiheet (istunto, Pi, työtilat) merkkeineen', fn: 'v3' },
  { name: 'Nykyinen', axis: 'vertailukohta: tuotannon Ladataan-otsikko ja yläreunan Ladataan palvelimen tilaa -rivi', fn: 'v4' },
];
