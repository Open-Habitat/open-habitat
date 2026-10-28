// Sanelu viestikenttään (proto-speech-input, 28.10.2026). Pohja: research-soniox-speech-input
// ja Jarin päätös 27.10. (D + P1): daemon luo kertakäyttöisen väliaikaisen Soniox-avaimen ja
// selain striimaa suoraan Sonioxille; sanelu ei saa katketa minuuttiin, ja tarkka katto
// päätetään tässä. Sisältö on sama kaikissa suunnissa: sama pitkä synteettinen sanelu, tauot,
// välitulokset, lopetus, virheet ja ei avainta -tila. Suunnat eroavat siinä, mikä pitkän
// sanelun lopulta päättää.
export const title = 'Sanelu viestikenttään · mikä päättää pitkän sanelun';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Katto', axis: 'kiinteä 30 minuutin katto, jonka Soniox valvoo: 25 minuutin kohdalla kenttä kertoo jäljellä olevan ajan, ja 30:00 sanelu päättyy teksti tallessa', fn: 'spCap' },
  { name: 'Hiljaisuus', axis: 'ei näkyvää aikakattoa: sanelu jatkuu niin kauan kuin puhut, ja kolmen minuutin hiljaisuus päättää sen (takaraja 4 h)', fn: 'spSilence' },
  { name: 'Jatkokysymys', axis: 'sanelu kysyy 25 minuutin välein, jatketaanko; vastaamatta jäänyt kysymys päättää sen 5 minuutin päästä (takaraja 4 h)', fn: 'spAsk' },
];
