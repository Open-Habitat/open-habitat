# Tulokset

### Jarin vastaukset kierrokseen 3 (27.11.2026)

- Tekstin kaltainen *Uusi keskustelu työtilassa kotisivu. Malli on oletusmalli.*
  on tarpeeton: ei kerrota sitä, minkä näkymä jo näyttää. Toteutuksessa
  saapumisesta jää vain kierroksen 2 merkki (*Viesti linkistä. Mitään ei ole
  lähetetty.*).
- **Linkin tekemiselle ei tule painiketta** työtilasivulle eikä valikkoon.
  Linkit tehdään ohjelmallisesti (automaatio, agentti). Habitat tarvitsee vain
  dokumentaation linkin muodosta, jotta agentti osaa tehdä sen (agentin
  ohje / `open-habitat skill print agent`).

## Kierros 3

Prototyyppi: `design-system/prototypes/rounds/2026-11-27-keskustelulinkit-3/`
(rakennus ja tilanteet sen `NOTES.md`:ssä), tulos
`design-system/prototypes/dist/2026-11-27-keskustelulinkit-3/offline.html`.
1440 ja 390 px, kolme teemaa.

### Jarin päätökset kierroksesta 2 ja mitä muuttui

- **Linkit pois → tyhjä kenttä.** *Oma sivu* on poistettu. Työtilan uusi
  keskustelu avautuu tyhjällä kentällä, ja ilmoitus *Linkin viestiä ei
  kirjoitettu kenttään* tarjoaa *Avaa asetus*. Viestiä ei näytetä.
- **Asetukset avautuu kuten tuotannossa:** kerroksena keskustelun päälle.
  Keskustelu pysyy sen alla piilossa, eikä *Tulit linkistä · Palaa linkkiin*
  -palkkia ole. *Avaa asetus* avaa osion, ja fokus on keskustelulinkkien
  rivillä (tuotannon `/settings/<osio>#<rivi>`). Sallimisen vahvistus on sama
  kuin kierroksella 2. Kun asetukset suljetaan, ollaan samassa uudessa
  keskustelussa, ja viesti on kentässä merkin *Viesti linkistä. Mitään ei ole
  lähetetty.* kanssa. Jos asetukset suljetaan sallimatta, kenttä ja ilmoitus
  jäävät ennalleen. Jos henkilö ehti kirjoittaa kenttään, viesti odottaa
  kortissa kuten oman luonnoksen kanssa muutenkin.
- **Osion nimi *Vaaralliset toiminnot*.** Ulkoasu on yhä kierroksen 2
  rauhallinen kortti, ei punaista tuhoavan toiminnon tyyliä.
- **Linkin tekeminen siirtyi työtilaan** (valitsimen akseli, alla), eikä sitä
  ole enää keskustelun ⋯-valikossa.

### Valitsimen akseli: missä linkki tehdään

- **A · työtilarivin ⋯.** Sivupalkin työtilarivi saa uuden ⋯-valikon, jossa
  on *Kopioi linkki uuteen keskusteluun…*. Tuotannon rivillä on nyt vain +.
- **A · työtilasivu (suositus).** Painike *Linkki uuteen keskusteluun…*
  työtilasivun otsikkorivin alla.

Molemmat näkyvät vain, kun linkit on sallittu. Suositus on työtilasivu,
koska linkin teko on harvinainen ja harkittu teko. Se ei tarvitse jokaiselle
sivupalkin riville uutta valikkoa, ja sivu toimii samoin puhelimessa, jossa
sivupalkki on laatikon takana.

### Päätökset katselmoitavaksi

- **Viesti pysyy selaimessa, kunnes linkit sallitaan.** Viesti on linkin
  fragmentissa (`#…&draft=`), jota selain ei lähetä hostille. Sovellus lukee
  fragmentin avatessaan ja poistaa sen heti osoiteriviltä
  (`history.replaceState`), joten viesti ei jää historiaan eikä kopioituun
  osoitteeseen. Kun linkit eivät ole sallittuja, viesti on vain avoimen
  keskustelunäkymän muistissa. Sitä ei kirjoiteta luonnossäilöön, ei
  `sessionStorage`en eikä mihinkään hostille lähtevään. Asetuksen
  tallennus lähettää daemonille vain päälle/pois-tiedon. Viesti siirtyy
  uuden keskustelun luonnokseen (`prepareField`) vasta, kun asetukset
  suljetaan linkit sallittuina. Jos välilehti ladataan uudelleen ennen sitä,
  viesti katoaa, ja linkkiä painetaan uudelleen. Sallimaton linkki ei saa
  jättää jälkeä mihinkään.
- **Yksi kytkin heti *Vaarallisissa toiminnoissa*,** ei ensin
  Kokeellisissa. Kokeellinen kertoo keskeneräisyydestä, ja tämä kytkin
  kertoo riskistä. Kahdessa paikassa sama lupa pitäisi myöntää kahdesti.
- Työtilarivin ⋯ ja työtilasivun painike piiloutuvat, kun linkit eivät ole
  sallittuja. Ihminen, joka ei käytä linkkejä, ei näe niistä mitään.

### Kysymykset Jarille

1. Linkin teko työtilasivulta (suositus) vai sivupalkin työtilarivin
   ⋯-valikosta?
2. Riittääkö yksi kytkin *Vaarallisissa toiminnoissa* heti alusta?
3. Riittääkö, että viesti katoaa, jos välilehti ladataan uudelleen ennen
   sallimista?

## Kierros 2

Prototyyppi: `design-system/prototypes/rounds/2026-11-27-keskustelulinkit-2/`
(rakennus ja tilanteet sen `NOTES.md`:ssä), tulos
`design-system/prototypes/dist/2026-11-27-keskustelulinkit-2/offline.html`.
1440 ja 390 px, kolme teemaa. Mukana myös `risky-features-settings`-osio.

### Päätökset kierroksesta 1 ja mitä muuttui

- **Vain A.** B ja C poistettu. Valitsimessa on kaksi A:n muunnelmaa
  kierroksen ainoasta uudesta kysymyksestä (alla).
- **Linkki avaa aina uuden keskustelun työtilassa:**
  `<origin>/new/<työtila>#n=<pituus>&draft=<viesti>`. Ei keskustelun nimeä,
  ei `from`-lähdettä, ei "keskustelua ei löydy → saa nimen" -logiikkaa eikä
  arkistoidun keskustelun tilannetta. Olemassa olevaan keskusteluun avaamista
  ei tehty edes tavallisella osoitteella: käyttötapaus (ilmoitus → tee jotain)
  on uuden tehtävän aloitus, ja olemassa olevan keskustelun kenttä toisi
  takaisin kesken olevan vuoron ja keskustelun oman luonnoksen tilanteet.
- **Merkki on yksi rivi:** *Viesti linkistä. Mitään ei ole lähetetty.* ja ×.
  Henkilö painoi linkkiä itse, joten rivi sanoo vain sen, mitä painallus ei
  kerro: teksti ei ole hänen, eikä mitään ole vielä lähtenyt.
- Säilyivät: oma luonnos ensin (kortti *Lisää viestisi perään / Korvaa /
  Hylkää*, nyt työtilan uuden keskustelun luonnokselle), arkistoitu työtila,
  puuttuva työtila, kirjautuminen, liian pitkä viesti. Linkin tekeminen
  keskustelun ⋯-valikosta: *Kopioi linkki uuteen keskusteluun tässä
  työtilassa…*, ikkunassa vain viesti, merkkimäärä ja linkki.

### Linkki, kun linkit eivät ole sallittuja (valitsimen akseli)

- **A · oma sivu (suositus).** Mitään ei avata. Sivu kertoo, mitä linkki
  tekisi, näyttää viestin vain luettavana ilman kopiointipainiketta ja tarjoaa
  *Avaa asetus* tai *Avaa työtila* ilman viestiä.
- **A · tyhjä kenttä.** Työtilan uusi keskustelu avautuu tyhjällä kentällä,
  ja ilmoitus kertoo, ettei viestiä kirjoitettu, sekä *Avaa asetus*. Viestiä
  ei näytetä.

Suositus on oma sivu: pois päältä oleva linkki ei saa ohjata sovellusta
mihinkään, ja tässä kohdassa ihminen päättää, salliiko hän linkit lainkaan,
joten viesti on juuri se tieto, jolla hän päättää. Kopiointipainike olisi
sama kyky toista reittiä. *Avaa asetus* vie osioon, rivi saa fokuksen, ja
osion yläreunassa on *Tulit linkistä · Palaa linkkiin*; sallimisen jälkeen
paluu tuo viestin kenttään. Sallia ei voi linkin sivulta, jotta vahingollinen
linkki ei ole yhden painalluksen päässä omasta luvastaan.

### Asetusosio riskialttiille toiminnoille

- **Nimi: *Sallitut riskit*.** Sanoo, mitä osiossa tehdään (sallitaan) ja
  mitä jäsenet ovat (riskejä), ilman hälytyssanaa. *Vaaralliset toiminnot*
  sekoittuisi vaaralliseen (punaiseen, tuhoavaan) painikkeeseen ja poistoon,
  eikä design-kielen rauhallinen sävy kanna sitä. Katselmointipalkissa voi
  vaihtaa nimeksi myös *Vaaralliset toiminnot* tai *Erikseen sallittavat*.
- **Paikka:** heti Tilin, Laitteiden ja Avainten jälkeen eli turvallisuusosioiden
  joukossa, kaukana listan lopun *Kokeellisista ominaisuuksista*. Ikoni kilpi.
- **Ulkoasu, tarkoituksella eri kuin Kokeelliset:** yksi kortti riveinä, ei
  kuvia eikä Pois/Päällä-segmenttiä. Rivillä nimi, yksi rivi siitä mitä
  toiminto tekee, tila sanana (*Ei sallittu* / varoitusmerkki ja *Sallittu*) ja teon nimeävä
  painike (*Salli…* / *Poista käytöstä*). *Sallii:* -lause on aina näkyvissä,
  ja kun toiminto on päällä, se korostuu pehmeällä punaisella reunalla ja
  rivi kertoo, milloin se sallittiin.
- **Päälle vahvistuksella, pois heti.** *Salli…* avaa ikkunan: varoituslaatikko
  (*Kun tämä on päällä* ja kuka voi käyttää kykyä), *Ei koskaan* (mitä se ei
  tee) ja tieto, että asetus koskee tiliä kaikilla laitteilla. Painikkeet
  *Salli keskustelulinkit* ja *Peru*; Esc peruu. Poisto ei kysy mitään, koska
  pois on aina turvallinen suunta.
- **Skaalautuvuus:** tilanne *kolme jäsentä* näyttää kaksi neutraalia
  paikkamerkkiä, joista toisessa on kolmen lauseen varoitus.

### Päätökset katselmoitavaksi

- Asetus on tilin (daemonin tallentama kuten Kokeelliset), ei laitteen.
  Linkin viestin lukee selain, mutta lupa koskee ihmistä, ja laitekohtainen
  lupa pitäisi myöntää jokaisessa selaimessa erikseen.
- Linkin tekeminen on keskustelun ⋯-valikossa, ja kohta näkyy vain, kun
  linkit on sallittu. Luontevampi paikka toteutuksessa voi olla työtilarivin
  `…`-valikko tai työtilasivu, koska linkki kohdistuu työtilaan.
- Varoituksen värinä on vaarallisen sävyn pehmeä pinta, koska tokeneissa ei
  ole erillistä varoitussävyä.

### Kysymykset Jarille

1. Oma sivu (suositus) vai tyhjä kenttä, kun linkit eivät ole sallittuja?
2. Osion nimi: *Sallitut riskit*, *Vaaralliset toiminnot* vai *Erikseen
   sallittavat*?
3. Riittääkö linkin teko keskustelun valikosta, vai siirretäänkö se työtilan
   valikkoon?

### Jarin vastaukset kierrokseen 2 (27.11.2026)

- Kun linkit eivät ole sallittuja: **tyhjä kenttä**.
- Osion nimi: **Vaaralliset toiminnot**.
- Linkin teko: linkissä on työtila mukana, joten se tehdään työtilan valikosta.
- *Palaa linkkiin* ei tarvita: asetukset on modaali, ja sen sulkeminen palaa
  linkin avaamaan keskusteluun, jossa linkin viesti sitten näkyy.

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

### Jarin vastaukset kierrokseen 1 (27.11.2026)

- **A** valittiin.
- Keskustelun pysyvä nimi linkissä tuntuu oudolta eikä ehkä tarpeelliselta.
- Lähdettä (*linkin mukaan x*) ei tarvita; käyttäjä ymmärtää, mistä on kyse.
- Uusi: ominaisuus kytketään päälle asetusten osiossa vaarallisille
  toiminnoille (`risky-features-settings`), varoituksen kanssa; linkit ovat
  sen ensimmäinen jäsen. Kierros 2 näyttää molemmat.

