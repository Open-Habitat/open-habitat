// Koko työtilasivu ilman kontekstivalikoita (proto-workspace-page-2, 16.10.2026; riffi
// kierroksista 2026-10-16-tyotilasivu, -spinoffit ja -prosessilohkot). Jari käytti
// toteutettua sivua: sivupalkin työtilarivillä ei tarvita …-valikkoa, pelkkä + riittää, eikä
// työtilasivullakaan; toiminnot näkyviin muuten. Akseli: missä työtilan omat toiminnot
// (kopioi polku, GitHub, näyttönimi, piilotus, poisto) näkyvät, kun …-valikkoa ei ole.
// Sisältö ja järjestys ovat samat kaikissa: otsake, Git-nappi, avoimet katsauskortteina
// huomiojärjestyksessä odotustiloineen (Odotan …), Valmiit ja Arkisto taitettuina, ja
// arkistointi kortista Hetki alhaalla -ilmoituksella.
export const title = 'Työtilasivu ilman valikoita';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Asioiden vieressä', axis: 'jokainen toiminto on sen tiedon vieressä, jota se koskee: nimen kynä, polun kopio ja GitHub-linkki otsakkeessa; piilotus ja poisto sivun lopun hiljaisella rivillä', fn: 'v1' },
  { name: 'Ikonirivi', axis: 'toiminnot ovat otsakkeen oikeassa reunassa näkyvinä ikoneina samalla kielellä kuin keskustelun yläpalkki; estetty kertoo syynsä', fn: 'v2' },
  { name: 'Työtila-osio', axis: 'otsakkeessa vain nimi, polku, Git ja +; työn jälkeen Työtila-osio, jossa jokainen tieto on rivinä nimettyine painikkeineen', fn: 'v3' },
];
