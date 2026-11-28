# Tulokset

## Kierros 1 · 28.11.2026

Prototyyppi: `design-system/prototypes/rounds/2026-11-28-agentin-ohje-kysymykset-1/`
(rakennus ja tarkistus kierroksen `NOTES.md`:ssä; `check.mjs` 555 tarkistusta
läpi: 1440 vaalea ja tumma, 390, molemmat näkymät ja kaikki tilanteet).

**Akseli: mitä ylläpitäjä muokkaa.**

- **1 Lisäkysymykset** (issuen ehdotus). Asetukset › Käyttöönotto saa reitin
  viimeiseksi riviksi *Ohjeet agentille*. Paneelissa on kysymykset siinä
  järjestyksessä, jossa agentti ne kysyy: Habitatin kolme kysymystä
  kiinteinä ilman painikkeita, sitten sivuston omat (siirto ylös/alas vain
  omien kesken, Muokkaa), ja lopuksi omin sanoin. Enintään viisi omaa.
- **2 Koko keskustelu.** Sama rivi, mutta paneeli on koko keskustelu
  sellaisena kuin henkilö sen näkee. Habitatin kysymykset voi piilottaa ja
  siirtää (omin sanoin pysyy viimeisenä), omat kysymykset muokataan
  paikallaan.

Molemmissa samat:

- Kysymyksen lomake: kysymys, valinnainen lisätieto henkilölle, vastaustapa
  *Vaihtoehdot / Omin sanoin / Molemmat*, enintään neljä vaihtoehtoa
  (painike ja lause, jonka se lisää lappuun). Lomakkeen *Henkilö näkee*
  -esikatselu näyttää kuplan ja painikkeet. Kun valitsee vaihtoehdon,
  näkyy lause, joka lappuun tulee. Tyhjä kysymys katoaa Valmis-painikkeella.
- Ilman omia kysymyksiä henkilö näkee Habitatin nykyiset kysymykset;
  reittirivi sanoo sen.
- Henkilö näkee ylläpitäjän kysymyksen omana vuoronaan merkinnällä
  *Ylläpitäjän kysymys*, ja siihen voi aina vastata *Ohita*. Valittu lause
  tulee lappuun *kysy ensin* -lauseen jälkeen, ja vapaa vastaus tulee
  kysymyksen otsikon alle ennen kohtaa *Omin sanoin*. Lappu tallentuu
  vasta, kun henkilö on nähnyt sen kokonaan, kuten nyt.
- Kun kysymyksiä muutetaan myöhemmin, valmiisiin lappuihin ei kosketa. Lappu
  on ainoa kirjanpito: kysymykseen on vastattu, jos lapussa on sen otsikko
  tai jokin sen lauseista. Uusi tai uudelleen sanoitettu kysymys näkyy jo
  liittyneelle henkilölle Asetukset › Tili › Ohjeet agentille -sivulla
  ilmoituksena, ja *Vastaa* kysyy vain sen ja lisää vastauksen vanhan
  tekstin perään.

Host-tiedot, joita näkymä olettaa: `instructions.questions`
käyttöönoton asetuksissa ja `GET /api/v1/onboarding/site` -vastauksessa
issuen mukaisesti. Suunnassa 2 lisäksi Habitatin kysymysten
piilotus ja järjestys samassa listassa. Mitään ei tallenneta vastauksista
erikseen, eikä daemon saa sivustolta uutta syötettä.

Kierroksen omat ratkaisut, jotka jäävät arvioitaviksi: kysymykset ovat
yhdellä kielellä (issue ehdotti suomea ja englantia rinnakkain), ja *Ohita*
on jokaisessa ylläpitäjän kysymyksessä.

### Kysymykset Jarille

1. Kumpi: saako ylläpitäjä vain lisätä omia kysymyksiä (1), vai myös
   piilottaa ja siirtää Habitatin kysymyksiä (2)?
2. Riittääkö, että kysymys kirjoitetaan yhdellä kielellä ja näytetään
   kaikille sellaisenaan, vai kirjoitetaanko jokainen kysymys ja vaihtoehto
   sekä suomeksi että englanniksi?
3. Näytetäänkö jo liittyneille Asetuksissa ilmoitus uudesta kysymyksestä,
   vai koskevatko kysymykset vain uusia lappuja?
