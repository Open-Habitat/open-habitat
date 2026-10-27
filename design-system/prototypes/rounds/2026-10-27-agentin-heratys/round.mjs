export const title = 'Pysähtyneen agentin herätys · kierros 1';
export const app = true;
export const recap = false;
export const strip = true;
export const variants = [
  {name: 'Kirjoittaessa', axis: 'Herättää kirjoittaminen: Pi käynnistyy ensimmäisestä merkistä, kierros jatkuu viestistä', fn: 'wkType'},
  {name: 'Painike', axis: 'Herättää painallus: langan lopussa lepotilan kortti ja Herätä ja jatka', fn: 'wkButton'},
  {name: 'Avatessa', axis: 'Herättää avaaminen: uutta sisältävä keskustelu herää itse, ellet peru', fn: 'wkOpen'},
];
