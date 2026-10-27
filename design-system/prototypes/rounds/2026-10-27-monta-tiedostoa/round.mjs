export const title = 'Agentin tiedosto ihmiselle · kierros 3: monta tiedostoa';
export const app = true;
export const variants = [
  {name: 'Ryhmät', axis: 'Kortti jäsentää paketin tyypeittäin; keskustelun voi suodattaa pelkkiin tiedostoihin', fn: 'mfType'},
  {name: 'Kansio', axis: 'Kortti on paketin kansio: selataan kansioittain ja haetaan kortin sisältä', fn: 'mfFolder'},
  {name: 'Hylly', axis: 'Kortti on tiivis kooste; keskustelun kaikki tiedostot ovat yhdessä paneelissa', fn: 'mfShelf'},
];
export const recap = false;
