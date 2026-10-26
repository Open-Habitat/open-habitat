export const title = 'Agentin tiedosto ihmiselle · kierros 1';
export const app = true;
export const variants = [
  {name: 'Kortti', axis: 'Oma tarjouskortti vastauksen jälkeen, kuten HTML-näkymän tarjous', fn: 'foCard'},
  {name: 'Vastauksessa', axis: 'Tiedostot ovat osa vastausta: kuva tekstissä, muut liitesiruina', fn: 'foInline'},
  {name: 'Hylly', axis: 'Langassa vain rivi; keskustelun tiedostot omassa paneelissaan', fn: 'foShelf'},
];
export const recap = false;
