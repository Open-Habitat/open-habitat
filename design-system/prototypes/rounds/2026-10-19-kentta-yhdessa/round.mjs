// Kenttä yhdessä (proto-composer-combined, 19.10.2026): Jarin valitsema yhdistelmä
// kierrokselta 2026-10-19-kentan-lisat. Näkyvät Komennot- ja Tiedosto-painikkeet, kirjoitettu
// `/` ja `@` täydentyvät kursorissa, `!` ja `!!` ovat vain kirjoitettuja (Kursorissa-tapa) ja
// Ctrl/⌘+P avaa Ponnahduksen paletin. Painikkeen valikko ja kursorin lista ovat sama lista
// kahdessa paikassa. Suunnat eroavat vain painikerivin paikassa ja painossa.
export const title = 'Kenttä yhdessä · painikkeet, kursori ja paletti';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Alarivi', axis: 'painikkeet nimineen kentän omalla alarivillä; uudessa keskustelussa samalla rivillä oikealla on mallin valitsin, kuten tuotannossa', fn: 'v1' },
  { name: 'Yläpuolella', axis: 'painikkeet nimineen kevyenä rivinä kentän yläpuolella, kentän ulkopuolella; kenttä itse pysyy paljaana yhtenä rivinä', fn: 'v2' },
  { name: 'Ikonit', axis: 'pelkät / ja @ -ikonit kentän sisällä Lähetä-painikkeen vieressä; nimi näkyy vihjeenä, kenttä ei kasva riviä', fn: 'v3' },
];
