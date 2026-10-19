// Välivastaukset (proto-interim-replies, 19.10.2026). Claude kirjoittaa vuoron keskellä
// lyhyen tilannetiedon ("Working tree on puhdas …") ja jatkaa työkaluilla. Tuotannossa se
// on tavallinen tekstirivi työn seassa ja katoaa, kun työ on kiinni. Kaikki suunnat näyttävät
// välivastauksen viestinä myös työ kiinni; ne eroavat siinä, mikä välivastaus on suhteessa
// työhön ja lopulliseen vastaukseen. Neljäs kohta on tuotannon nykytila vertailuksi.
export const title = 'Agentin vuoro · välivastaukset';
export const app = true;
export const variants = [
  { name: 'Viesti langassa', axis: 'välivastaus on oma viestinsä aikajärjestyksessä: työ taittuu pois sen ympäriltä, kupla jää langalle', fn: 'v1' },
  { name: 'Osa vastausta', axis: 'välivastaus kuuluu vuoron vastaukseen: kaikki Pi:n viestit kootaan yhteen vastauskorttiin, työssä vain viittaus', fn: 'v2' },
  { name: 'Vaiheet', axis: 'välivastaus päättää työvaiheen: vuoro jakautuu vaiheisiin, joilla kullakin oma tiivistelmä ja viesti', fn: 'v3' },
  { name: 'Nykyinen', axis: 'tuotanto 19.10.: tekstirivi työn seassa, piilossa kun työ on kiinni', fn: 'v4' },
];
