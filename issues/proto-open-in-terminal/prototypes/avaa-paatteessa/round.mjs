// Päätteestä aloitettu keskustelu selaimessa (proto-open-in-terminal, 28.10.2026). Pi:n
// keskustelu on aloitettu SSH:n yli henkilön omassa tmuxissa; selain näyttää sen historian vain
// luettavana, koska päätteen Pi kirjoittaa siihen. Sisältö, tilanteet (tmuxissa, ilman tmuxia,
// päättynyt), sivupalkki, yläpalkki ja päätepaneeli ovat samat kaikissa suunnissa; suunnat
// eroavat siinä, kuinka pitkälle selain menee: kertooko se paikan, näyttääkö se päätteen vai
// antaako se jatkaa siinä. Keskustelu, tmux-nimet, PID:t ja ajat ovat keksittyjä.
export const title = 'Päätteessä aloitettu keskustelu';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Kerro', axis: 'selain kertoo, missä Pi pyörii, ja antaa kopioitavan komennon; se ei koske henkilön tmuxiin', fn: 'otTell' },
  { name: 'Katso', axis: 'selain näyttää päätteen paneelissa vain luettavana peilinä; päättyneen jatkokomento odottaa paneelissa Enteriä', fn: 'otWatch' },
  { name: 'Jatka', axis: 'selain liittyy samaan tmux-ikkunaan toisena asiakkaana tai käynnistää päättyneen keskustelun Pi:n selaimen päätteeseen', fn: 'otTake' },
];
