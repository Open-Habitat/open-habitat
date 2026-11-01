// Open Habitatin oma merkki (1.11.2026). Nykyinen kaari ja piste laatalla on Landing.tsx:n
// mukaan paikanpitäjä "kunnes Open Habitatilla on oikea merkki". Suunnat eroavat siinä,
// mistä merkki kertoo: Kynnys ovesta, Kennot erillisistä huoneista yhdessä talossa,
// Kehote natiivista päätteestä, Pesä elävästä ympäristöstä ja oh nimestä itsestään.
// Sisältö on sama kaikissa: iso merkki, logotyyppi, koot 128→16 px, sovelluskuvake,
// selaimen välilehti sekä latausnäkymä, sivupalkki ja kirjautuminen.
export const title = 'Open Habitat · merkki';
export const variants = [
  { name: 'Kynnys', axis: 'arkkitehtuuri: avoin ovi, josta valo tulee ulos', fn: 'lgKynnys' },
  { name: 'Kennot', axis: 'yhteisö: jokaisella oma huone samassa pesässä', fn: 'lgKennot' },
  { name: 'Kehote', axis: 'tekniikka: katto ja kursori, natiivi pääte kotina', fn: 'lgKehote' },
  { name: 'Pesä', axis: 'luonto: avoin rengas ja verso, elävä ympäristö', fn: 'lgPesa' },
  { name: 'oh', axis: 'typografia: nimen kirjaimet ovat merkki', fn: 'lgOh' },
];
