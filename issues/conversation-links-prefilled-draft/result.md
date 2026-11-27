# Tulokset

## Kierros 1

Prototyyppi: `design-system/prototypes/rounds/2026-11-27-keskustelulinkit-1/`
(rakennus ja tilanteet sen `NOTES.md`:ssä), tulos
`design-system/prototypes/dist/2026-11-27-keskustelulinkit-1/offline.html`.
Tuotannon kehys, rail, yläpalkki ja kenttä; 1440 ja 390 px, kolme teemaa.

### Suunnat (akseli: miten linkin viesti saapuu)

- **A Merkitty kenttä.** Keskustelu avautuu heti, ja viesti on kentässä.
  Kentän ensimmäinen rivi (sama muoto kuin vastauksen lainauksessa,
  katkoviivareuna) sanoo *Viesti linkistä · linkin mukaan `yoajo-botti`*
  ja *Mitään ei ole lähetetty*. × poistaa viestin. Merkki pysyy
  lähettämiseen asti, myös jos tekstiä muokkaa.
- **B Vahvistus.** Ennen kuin mitään avautuu, arkki näyttää kohteen, linkin
  väittämän lähteen ja viestin: *Avaa ja lisää viesti*, *Avaa ilman
  viestiä*, *Peru*. Sen jälkeen kuten A. Puhelimessa arkki on alhaalla.
- **C Ehdotus.** Kenttä pysyy henkilön omana. Viesti odottaa kortissa kentän
  yllä: *Siirrä kenttään* tai *Hylkää*. Siirretty teksti on henkilön omaa,
  joten merkkiä ei enää ole.

**Suositus: A.** Linkki on yleensä oma automaatio, jonka viesti halutaan
lähettää; B lisää jokaiseen avaukseen painalluksen, joka toistuessaan
kuitataan lukematta. A:n merkki pitää lähteen näkyvissä juuri silloin, kun
Lähetä painetaan. C jää A:n osaksi tilanteeseen, jossa kentässä on jo jotain.

### Päätökset katselmoitavaksi

- **Linkin muoto (luonnos).**
  `<origin>/new/<työtila>#from=<lähde>&n=<pituus>&draft=<viesti>` ja
  `<origin>/c/<työtila>/<keskustelun nimi>#…`. Viesti on fragmentissa:
  selain ei lähetä sitä hostille, lokeihin eikä Referer-otsakkeeseen, ja
  sovellus lukee sen itse. `n` on viestin merkkimäärä, joten chat-sovelluksen
  katkaisema linkki tunnistetaan.
- **Ei automaattista lähetystä.** Mikään linkin osa ei lähetä, valitse mallia
  tai aja komentoa; viesti päätyy vain kenttään, ja Lähetä on aina
  henkilön oma painallus. Linkissä ei ole muita parametreja.
- **Lähde on väite.** `from` näytetään muodossa *linkin mukaan `x`*, ei
  lähettäjänä, koska kuka tahansa voi kirjoittaa sen. Ilman sitä: *lähde ei
  tiedossa*. Linkki ei anna pääsyä mihinkään: se avautuu avaajan omassa
  Habitatissa hänen omilla työtiloillaan.
- **Koko.** Viestin raja 4 000 merkkiä. Liian pitkä tai katkennut viesti
  jätetään kokonaan pois ja siitä kerrotaan; osaa ei näytetä, koska
  katkaistu ohje voi tarkoittaa muuta kuin koko ohje. Linkin tekijän ikkuna
  estää kopioinnin rajan yli.
- **Oma luonnos ensin.** Jos kentässä on jo keskeneräinen viesti, linkin
  viesti ei korvaa sitä vaan odottaa kortissa (*Lisää viestisi perään*,
  *Korvaa*, *Hylkää*), kaikissa suunnissa.
- **Agentti kesken vuoron.** Viesti tulee kenttään tavalliseen tapaan, ja
  merkki sanoo, että se lähtee vuoron jälkeen kentän tilan mukaan.
  Linkki ei ohjaa vuoroa.
- **Virheet.** Työtilaa ei löydy: oma sivu, jossa viesti tallessa (*Kopioi
  viesti*) ja muut työtilat aloituspaikoiksi. Arkistoitu työtila: keskustelu
  aloitetaan silti, ilmoituksessa *Palauta työtila*. Arkistoitu keskustelu:
  viesti odottaa kentässä, kenttä estetty syyn kanssa, *Palauta ja jatka*
  tai *Uusi keskustelu tällä viestillä*. Keskustelua ei löydy: uusi
  keskustelu, joka saa linkin nimen ensimmäisestä lähetyksestä, joten
  automaatio voi avata saman keskustelun yhä uudelleen. Ei kirjautunut:
  kirjautumissivu kertoo, mihin jatketaan; sovellus pitää fragmentin
  selaimessa kirjautumisen ajan, joten viesti ei kulje kirjautumispalvelun
  kautta.
- **Linkin tekeminen.** Keskustelun ⋯-valikossa *Kopioi linkki, joka avaa
  tämän keskustelun viestillä…*: tämä keskustelu tai uusi keskustelu samassa
  työtilassa, viesti, vapaaehtoinen lähde, merkkimäärä ja linkki. ⋯ on
  tuotannossa työpöydällä piilossa, kunnes rivi lyhenee; kierros näyttää sen
  aina. Agentti tai automaatio tekee linkin samasta muodosta suoraan
  (työtilan ja keskustelun nimi riittävät); myöhemmin sen voisi tulostaa
  `open-habitat agent` -komento.
- **Host-tiedot, joita näkymä olettaa.** Työtilan haku nimellä (sama kuin
  railin nimi) ja keskustelulle pysyvä nimi, jolla sen löytää työtilasta.
  Uudessa keskustelussa luonnos menee samaan luonnossäilöön kuin Aloita-oppaan
  valmistelema teksti (`prepareField`).

### Kysymykset Jarille

1. A (suositus), vai haluatko vahvistuksen (B) ainakin silloin, kun linkki ei
   kerro lähdettä?
2. Mikä on keskustelun pysyvä nimi linkissä: oma, otsikosta erillinen
   tunniste (kierroksella `yoajot`), joka annetaan nimetessä tai linkkiä
   tehdessä, vai keskustelun otsikko, jolloin nimen vaihto katkaisee linkit?
3. Riittääkö lähteeksi linkin väite, vai tarvitaanko myöhemmin hostin
   allekirjoittamia linkkejä omille automaatioille, jolloin lähde voitaisiin
   näyttää varmistettuna?
