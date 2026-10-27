export const title = 'Agentin tiedosto ihmiselle · kierros 2: tiedostotyypit';
export const app = true;
export const variants = [
  {name: 'Tunniste', axis: 'Kortti kertoo tyypin ja tosiasiat; sisältö avautuu vasta esikatselussa (kuvat näkyvät kuten kierroksella 1)', fn: 'ftFacts'},
  {name: 'Kurkistus', axis: 'Kortissa on tyypin mukainen pysähtynyt kurkistus: pysäytyskuva, aaltomuoto, ensimmäinen sivu, alkurivit, sisällysluettelo', fn: 'ftPeek'},
  {name: 'Soitin', axis: 'Kortti on katselin: video ja ääni soivat, Markdown, CSV ja koodi luetaan ja sivut selataan kortissa', fn: 'ftLive'},
];
export const recap = false;
