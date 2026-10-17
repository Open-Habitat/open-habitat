// Repon valinta ja kloonaus uudeksi työtilaksi (proto-repo-selection, 17.10.2026).
// Jarin northwind-monorepo katkesi julkaisun uudelleenkäynnistykseen ja jätti 910 MB:n
// .git-hakemiston ilman committeja. Repon löytäminen (omat, organisaatiot, viimeisimmät,
// haku, aikasuodatus käyttäjän valintana), repon tiedot ennen kloonausta, suuren repon
// kevyt klooni ja kolme lopputulosta ovat samat kaikissa suunnissa. Suunnat eroavat
// vain siinä, missä käynnissä oleva ja keskeneräinen kloonaus asuu.
export const title = 'Repon valinta ja kloonaus';
export const app = true;
export const composer = false;
export const recap = false;
export const variants = [
  { name: 'Dialogissa', axis: 'kloonaus elää dialogissa, joka pysyy auki loppuun asti; keskeytynyt klooni jää sivupalkkiin rikkinäisenä työtilana', fn: 'v1' },
  { name: 'Kloonaussivulla', axis: 'Uusi työtila on oma sivunsa, jonka yläosassa käynnissä olevat ja keskeneräiset kloonaukset asuvat; sivulta voi lähteä, ja sivupalkki näyttää tilan', fn: 'v2' },
  { name: 'Heti työtilana', axis: 'Kloonaa luo työtilan sivupalkkiin heti; työtilan sivu on kloonauksen edistyminen, virhe ja korjaus, kunnes se on valmis', fn: 'v3' },
];
