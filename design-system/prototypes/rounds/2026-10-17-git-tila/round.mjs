// Git-tila keskustelunäkymässä (issue proto-git-status-panel, 17.10.2026). Jari: missä
// haarassa ollaan, mikä sen tila on, paljonko se on edellä mistäkin ja paljonko etärepoista
// on tulossa, nuolet ylös ja alas ja muuttuneiden tiedostojen määrä; painike avaa tarkemmat
// tiedot. Sama sisältö kaikissa: aurinkokellon haara status-rivit, seurantahaara
// origin/status-rivit (2 lähettämättä, 1 tulossa), pohjahaara main (5 edellä, 3 jäljessä),
// neljä muuttunutta tiedostoa, viimeisin haku 25 min sitten. Hae etärepo tuo mainiin yhden
// uuden commitin, ja vuoron päätyttyä tila luetaan uudelleen (agentin muokkaus näkyy).
// Suunnat eroavat siinä, missä tila asuu, kuinka paljon se sanoo levossa ja millainen
// tarkempi näkymä on.
export const title = 'Keskustelu · Git-tila';
export const app = true;
export const recap = false;
export const strip = true;
export const variants = [
  { name: 'Yläpalkissa', axis: 'tiivis merkki yläpalkissa mallin vieressä (haara, ↑↓ seurantahaaraan, muutosten määrä); avautuu ankkuroituna ponnahduksena, puhelimessa alapaneelina, jossa commitit ovat taitettuina', fn: 'v1' },
  { name: 'Kentän yllä', axis: 'merkki taustatyön merkkien rinnalla kentän yllä, missä agentin työ näkyy; avautuu samaan kelluvaan paneeliin kuin taustatyö, välilehtinä Muutokset ja Commitit', fn: 'v2' },
  { name: 'Haararivi', axis: 'koko levyinen ohut rivi yläpalkin alla, joka sanoo tilan sanoin ja kertoo myös pohjahaaran; avautuu sivupaneeliksi, jossa kaikki on auki ja muutoksilla on rivimäärät', fn: 'v3' },
];
