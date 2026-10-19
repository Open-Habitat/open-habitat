// Kentän lisät (proto-composer-commands, 19.10.2026): `!`-komento työtilassa, `/`-komentojen
// ja taitojen täydennys sekä tiedostojen valinta (`@`, Ctrl/⌘+P), tmuxin `prefix C-f`
// -valitsimen hengessä. Sisältö on sama kaikissa suunnissa: Pi:n `get_commands`-lista
// (laajennukset, pohjat, taidot), aurinkokello-työtilan tiedostot git-tiloineen ja samat
// komentotulosteet. Suunnat eroavat siinä, missä valinta tapahtuu.
export const title = 'Kentän lisät · komennot ja tiedostot';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Kursorissa', axis: 'valinta tapahtuu kirjoituskohdassa: kirjoitettu ! / tai @ avaa pienen listan kursorin yläpuolelle, teksti pysyy tekstinä ja ! jää kenttään kuten Pi:n TUI:ssa', fn: 'v1' },
  { name: 'Ponnahdus', axis: 'valinta tapahtuu kutsuttavassa ikkunassa: Ctrl/⌘+P tai / ja @ avaavat tmux-popupin kaltaisen paletin, jossa on haku, esikatselu ja monivalinta; ! muuttaa kentän päätteeksi', fn: 'v2' },
  { name: 'Painikkeet', axis: 'valinta alkaa näkyvistä painikkeista kentän alareunassa: Komento-kytkin, Komennot ja Tiedosto avaavat valikon; kirjoitetut merkit toimivat oikotienä', fn: 'v3' },
];
