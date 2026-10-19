// Koko alakerta (proto-composer-area, 19.10.2026): Jarin valitsema Alarivi kokonaisena alueena,
// Lähetä, Ohjaa / Työn jälkeen, Stop, jono, taustatyön merkit ja `!` mukaan lukien. Suunnat
// eroavat siinä, missä Stop ja viestin tapa ovat alariviin nähden.
export const title = 'Koko alakerta · Lähetä, Stop ja viestin tapa';
export const app = true;
export const recap = false;
export const strip = true;
export const variants = [
  { name: 'Rivillä', axis: 'Lähetä, Stop ja viestin tapa kentän omalla alarivillä oikealla; tapa on yksi siru, joka vaihtaa Ohjaa ↔ Työn jälkeen', fn: 'v1' },
  { name: 'Vieressä', axis: 'Lähetä kentän vieressä kuten tuotannossa; Pi:n työn aikana sarakkeessa Stop ja nimetty jaettu Lähetä, jonka valikosta tapa valitaan', fn: 'v2' },
  { name: 'Työnauha', axis: 'kentän yläreunaan liittyvä nauha näyttää käynnissä olevan työn rivi riviltä omine Pysäytä-painikkeineen, viestin tavan ja jonon; Lähetä alarivin päässä', fn: 'v3' },
];
