// Selainpääte (proto-browser-shell, 19.10.2026). Henkilön tavallinen shell selaimessa, omana
// Unix-käyttäjänään ja työtilan hakemistossa. Päätteet elävät palvelimella tmuxissa, joten
// selaimen sulkeminen ei lopeta niitä; henkilön omat tmux-istunnot voi liittää. Sisältö,
// ensimmäisen avauksen hetki, kopiointi ja liittäminen, puhelimen näppäinrivi ja paluu ovat
// samat kaikissa suunnissa; suunnat eroavat siinä, mihin pääte kuuluu.
export const title = 'Selainpääte';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Paneeli', axis: 'pääte kuuluu keskusteluun: paneeli keskustelun alla, välilehdet työtilan päätteille, yläpalkin päätepainike ja Ctrl+` avaa ja piilottaa', fn: 'v1' },
  { name: 'Rivi', axis: 'pääte kuuluu työtilaan: päätteet ovat sivupalkissa keskustelujen rinnalla omina riveinään ja avautuvat koko näkymään kuin keskustelu', fn: 'v2' },
  { name: 'Oma näkymä', axis: 'pääte kuuluu henkilölle: sivupalkin Pääte avaa yhden näkymän, jossa kaikki päätteet ovat tmux-istunnoittain välilehtinä; työtila avaa sinne uuden', fn: 'v3' },
];
