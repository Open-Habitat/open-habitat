export const title = 'Kansiotarjouksen tiedostot: rivin omat toiminnot';
export const app = true;
export const recap = false;
export const variants = [
  {name: 'Leijuva', axis: 'Rivi avaa esikatselun; Esikatsele ja Lataa ilmestyvät rivin päähän osoittimella ja fokuksella, kosketuksella aina näkyvissä', fn: 'frHover'},
  {name: 'Näkyvä', axis: 'Jokaisella rivillä on aina tiedot ja kaksi painiketta; rivi itse ei tee mitään', fn: 'frShown'},
  {name: 'Avautuva', axis: 'Rivi aukeaa paikallaan tiedoiksi ja nimetyiksi painikkeiksi; yksi rivi kerrallaan auki', fn: 'frOpen'},
];
