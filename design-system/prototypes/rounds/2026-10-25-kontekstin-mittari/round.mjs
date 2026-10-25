export const title = 'Kontekstin käyttö · perustila';
export const app = true;
export const variants = [
  {name:'Rengas', axis:'Rengas ja prosentti yläpalkissa mallin vieressä', fn:'ctxRing'},
  {name:'Sirussa', axis:'Luku mallisirun sisällä, siru täyttyy', fn:'ctxChip'},
  {name:'Kentässä', axis:'Täyttöviiva kentän yläreunassa ja tokenit sen alla', fn:'ctxField'},
  {name:'Sanoin', axis:'Hiljainen teksti kentän alla, puhuu vasta rajan lähellä', fn:'ctxWords'},
];
