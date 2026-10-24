# Rinnakkainen muokkaus

## Kierros 2

**Suositus: Rivimerkit ja kahden sekunnin tauko.** Kun agentti tallentaa
tiedoston, jota muokkaat, editori huomaa sen heti, mutta ei muuta tekstiäsi
kesken kirjoittamisen. Rivit, joille agentin muutokset tulevat, saavat
katkoviivan ja merkin *odottaa*, ja työkalurivillä lukee "Agentin 2 muutosta
odottaa" sekä *Tuo nyt*. Kun et ole kirjoittanut kahteen sekuntiin, muutokset
tulevat tekstiin korostettuina. Näet etukäteen, mihin kohtaan ne tulevat, joten
teksti ei muutu yllättäen, eikä ilmoitus vie tilaa editorilta. Tilalla on
eniten merkitystä puhelimessa, jossa Ilmoitus-suunnan laatikko vie kapeasta
editorista monen tekstirivin korkeuden koko odotuksen ja tuonnin ajan.

**[Avaa kierros 2](https://glasspad.example.test/p/oez2lhaom63slfc4wzcjti2axm/).**
Suunta vaihdetaan alareunan valitsimesta (myös näppäimet 1–3, nuolet ja R).
Kokeile näin: paina *Kirjoita, ja agentti tallentaa kesken*. Editori kirjoittaa
riville 3 noin neljän sekunnin ajan, ja agentti tallentaa tiedoston 0,8
sekunnin kohdalla. Pysähdy sen jälkeen, paina Ctrl+Z ja sitten Ctrl+Y.
Katkoviivalaatikosta valitaan, osuuko agentin muutos samoille riveille kuin
omasi, tuliko muutos agentin työkalusta vai bashista tai SSH:sta, ja kuinka
pitkä tauko on (1, 2 tai 4 s). Editoriin voi myös kirjoittaa itse. Taulukko
näyttää, mitkä muutokset ovat levyllä ja mitkä editorissa. Se on arvioinnin
apuväline eikä kuulu tuotteeseen. Kaikki tiedot ovat keksittyjä.

### Kaikissa suunnissa sama (Jarin päätös 24.10.)

- **Huomaaminen heti, tuonti tauon jälkeen.** Muutokset tuodaan, kun
  viimeisestä näppäilystä on kulunut tauon verran. Lisäksi tuonti odottaa
  vähintään saman ajan siitä, kun muutos huomattiin. Teksti ei siis muutu
  samalla hetkellä, kun merkki ilmestyy, vaikka et olisi kirjoittamassa.
  *Tuo nyt* tuo muutokset heti.
- **Viimeistään Tallenna.** Jos muutokset vielä odottavat, Tallenna tuo ne
  ensin. Jos ristiriitoja ei ole, se tallentaa saman tien. Jos niitä on,
  tallennus jää odottamaan valintoja.
- **Ristiriita rivikohtaisesti.** Jokaisen rivin yllä, jota sekä sinä että
  agentti muutitte, on kortti: agentin rivi vihreällä ja painikkeet *Sinun*,
  *Agentin* ja *Molemmat*. Sinun rivisi näkyy kortin alla punaisena. Tallenna
  on pois käytöstä, kunnes jokainen kortti on ratkaistu, ja syy näkyy
  painikkeen alla. Myös vierekkäiset rivit ovat ristiriita (sama sääntö kuin
  GNU diff3:ssa ja gitissä).
- **Ctrl+Z peruu tuonnin yhtenä askeleena** korostuksineen ja avoimine
  ristiriitoineen, ja Ctrl+Y tai Ctrl+Shift+Z palauttaa sen. Jos kirjoitit
  tuonnin jälkeen, ensimmäinen Ctrl+Z peruu kirjoituksesi kuten editorissa
  aina. Siksi *Peru tuonti* -painike näkyy vain niin kauan, kuin tuonti on
  viimeisin muutos. Myös kortin valinta on tavallinen, peruttava muokkaus. Kun
  tuonti on peruttu, Tallenna muuttuu punaiseksi: *Tallenna ja korvaa agentin
  versio*. Vieressä on *Tuo uudelleen*.
- **Merkintä keskusteluun.** Jos tallennettuun tiedostoon ei jäänyt kaikkia
  agentin muutoksia (Ctrl+Z tai *Sinun* ristiriidassa), keskustelun loppuun
  tulee merkintä "Korvasit agentin muutoksia". Siinä luetellaan rivit, joita
  korvaus koski. *Kerro agentille* kirjoittaa kenttään luonnoksen
  ("Korvasin tallentaessani muutoksesi tiedostossa … Älä palauta näitä
  kysymättä."), jota voi muokata ennen lähettämistä. Pi:n historiaan ei
  lisätä mitään, ja merkinnässä kerrotaan, että agentti ei näe sitä.
- **Neutraali muoto.** Kun muutos ei tullut agentin `edit`- tai
  `write`-työkalusta (agentin bash-komento, muokkaus SSH:n kautta), teksti on
  "Tiedosto muuttui levyllä", ristiriitapainike on *Levyn* eikä keskusteluun
  tule merkintää.

### Suunnat

Akseli: kuinka näkyvä odottava muutos on.

| Suunta | Odottaessa | Tuonnin jälkeen | Hyöty | Hinta |
| --- | --- | --- | --- | --- |
| **1. Ilmoitus** | Laatikko työkalurivin alla: "Agentti muutti tätä tiedostoa 14.32. 2 muutosta odottaa — tuodaan, kun lopetat kirjoittamisen." ja *Tuo nyt*. | Laatikko kertoo, montako muutosta tuotiin ja että Ctrl+Z peruu tuonnin. Ristiriidoista on oma punainen laatikko. | Mikään ei jää huomaamatta, ja Ctrl+Z on kerrottu sanoin. | Vie tilaa koko ajan. Puhelimessa laatikko ja ristiriitakortit täyttävät editorin. |
| **2. Hiljainen merkki** | Työkalurivillä vihreä piste, "Agentin 2 muutosta odottaa" ja *Tuo nyt*. Tekstissä ei näy mitään. | Tila "Muokattu · agentin 2 muutosta tuotu" ja *Peru tuonti*. Agentin rivit on korostettu. | Ei vie tilaa tekstiltä. | Teksti muuttuu kohdassa, jota ei näytetty etukäteen. Merkin voi ohittaa kokonaan. |
| **3. Rivimerkit** (suositus) | Kuten 2. Lisäksi rivit, joille muutokset tulevat, saavat katkoviivan ja merkin *odottaa*. | Kuten 2. | Näet etukäteen, mihin muutos tulee, ja voit jättää sen rivin rauhaan. Ei vie tilaa. | Rivimerkit ovat uusi elementti tekstin sisällä. Näkymän ulkopuolelle osuvasta muutoksesta kertoo vain merkki työkalurivillä. |

### Tauon pituus

1 s tuo muutokset jo lyhyen ajattelutauon aikana kesken lauseen. 4 s tuntuu
siltä, ettei mitään tapahdu, ja houkuttelee painamaan *Tuo nyt*. Suosittelen
2 sekuntia. Tämä on harkinta eikä mittaus; tauon voi vaihtaa
katkoviivalaatikosta.

### Kolmen version yhdistäminen: node-diff3

Prototyyppi käyttää kirjastoa [node-diff3](https://github.com/bhousel/node-diff3).
Sen `dist/diff3.mjs` on kierroshakemistossa muuttamattomana
(`vendor/node-diff3.mjs`, lisenssi vieressä). Kierroksen oma koodi on
`merge.ts`: noin 80 riviä, joilla kirjaston tulos muutetaan editorin
käyttämään muotoon. Havainnot tuotannon riippuvuuspäätöstä varten:

- **Lisenssi:** MIT. **Riippuvuudet:** ei yhtään. **Koko:** ESM-tiedosto
  12 kt, gzipattuna 2,6 kt.
- **Ylläpito:** versio 3.2.1 (3.6.2026). Julkaisuja on vuosilta 2020–2026, ja
  välissä on tauko 6/2022–10/2025. Ylläpitäjä on yksi (Bryan Housel,
  OpenStreetMapin iD-editori). Latauksia on noin 326 000 viikossa.
- **Rajapinta:** `diff3MergeRegions` antaa jokaisesta kohdasta tiedon, kumpi
  puoli sen muutti tai onko se ristiriita. Siitä saadaan suoraan agentin rivit
  korostettaviksi, ristiriitakortit ja Kerro agentille -merkinnän rivit.
  `diffIndices` antaa rivitason muutokset, joilla tuonti tehdään CodeMirroriin
  pieninä muutoksina, niin että kursori ja omat rivisi pysyvät paikallaan.
- **Ansat:** merkkijono pilkotaan oletuksena *välilyönneistä*, joten kutsuun
  annetaan rivitaulukot. Tyypit ovat `any`, joten ohut tyypitetty kääre
  tarvitaan. Vierekkäisten rivien muutokset ovat ristiriita.
- **Vaihtoehdot:** `@codemirror/merge` (MIT, saman tekijän kuin editorimme)
  vertaa kahta versiota ja näyttää vertailunäkymän, mutta ei yhdistä kolmea
  versiota. `diff` (jsdiff, BSD-3) ei dokumentoi kolmen version yhdistämistä.
  Oman algoritmin Jari jo hylkäsi.

Suositus tuotantoon on node-diff3 tavallisena npm-riippuvuutena, lukittuna
`web/package-lock.json`iin. Riippuvuuden lisääminen on Jarin päätös.

### Mitä hostilta oletetaan

Kierros 1:n oletukset pätevät edelleen. Lisäksi:

- Agentin bash-komento ei näy tiedostotyökaluna. Jos editori lukee auki
  olevan tiedoston version uudelleen aina, kun mikä tahansa agentin
  työkalukutsu päättyy, myös bashin tekemä muutos huomataan heti. Se on
  tavallinen tiedoston luku daemonilta. SSH:n kautta tehty muutos huomataan,
  kun ikkuna saa fokuksen, ja ennen tallennusta.
- Keskustelun merkintä on selaimen näkymän tilaa. Se ei ole Pi:n historiassa
  eikä missään uudessa tallennuspaikassa, joten se häviää, kun sivu ladataan
  uudelleen. Agentin työkalukortti jää keskusteluun kuten nytkin.
- Tuonti, korostukset ja ristiriidat ovat CodeMirrorin tilaa (`StateField`),
  ja historia peruu ne `invertedEffects`illä. Uutta tallennuspaikkaa ei
  tarvita.

### Kysymykset Jarille

1. Rivimerkit vai Ilmoitus? Hiljainen merkki on mukana vertailukohtana.
2. Kelpaako kahden sekunnin tauko?
3. Riittääkö, että "Korvasit agentin muutoksia" -merkintä häviää sivun
   uudelleenlatauksessa? Pysyvä merkintä tarvitsisi uuden tallennuspaikan.
4. Lisätäänkö node-diff3 tuotannon riippuvuudeksi?

### Tarkistus

`node design-system/prototypes/rounds/2026-10-24-rinnakkainen-muokkaus-2/build.mjs`
rakentaa sivun. `check.mjs <html|url> <hakemisto>` käy läpi kolme suuntaa
leveyksillä 1440 ja 390, vaaleana ja tummana, ja tarkistaa valitsimen jaetulla
`picker-check.mjs`:llä. Jokaisessa suunnassa se ajaa neljä polkua:

- kirjoitus ja agentin tallennus kesken kirjoituksen: odottaessa agentin
  tekstiä ei ole puskurissa, tuonnin jälkeen kaikki ovat siellä, ja Ctrl+Z
  peruu tuonnin mutta säilyttää kirjoituksen;
- Tallenna odotuksen aikana;
- kaksi ristiriitaa, joista toisessa valitaan *Agentin* ja toisessa *Sinun*:
  merkintä ja Kerro agentille -luonnos ilmestyvät;
- neutraali muutos.

Tulos oli 72 tarkistuspistettä ja puhdas konsoli sekä paikallisesti että
julkaistulla sivulla (`evidence/r2/checks.json`,
`evidence/r2/hosted-checks.json`). Kuvat ja HTML-tilannevedokset ovat
`evidence/r2/`-hakemistossa.

## Kierros 1

**Suositus: Tuo heti.** Kun agentti tallentaa tiedoston, jossa sinulla on
tallentamattomia muutoksia, editori tuo agentin muutokset heti tekstiisi
korostettuina. Omat muutoksesi pysyvät, ja tuonnin voi perua yhdellä
painalluksella tai Ctrl+Z:lla. Valinta kysytään vain riveistä, joita molemmat
muuttivat, ja silloin vaihtoehdot näkyvät tekstin yllä omina riveinään.
Tallenna tarkoittaa aina samaa: levylle menee se, mitä editorissa näkyy.
Kysymys "kenen muutokset jäävät voimaan" ei synny lainkaan, kun muutokset
eivät osu samoille riveille, ja se on agentin kanssa tavallisin tilanne.

**[Avaa kierros](https://glasspad.example.test/p/dygk3vwxs662w26kuxlpptydvq/).**
Suunta vaihdetaan alareunan valitsimesta (myös näppäimet 1–4, nuolet ja R).
Yläreunasta vaihtuvat teema ja 390 px:n kehys. Kokeile näin: paina
*Agentti tallentaa tiedoston* ja sitten Tallenna. *Eri riveille / Samalle
riville* valitsee, osuuko agentin muutos samalle riville kuin omasi.
Katkoviivalaatikon taulukko näyttää jokaisen muutoksen kohdalla, onko se levyllä
ja onko se editorissa. Taulukko on arvioinnin apuväline eikä kuulu tuotteeseen.
Kaikki tiedot ovat keksittyjä, eikä sivu ota yhteyttä palvelimeen.

### Suunta 0 · Nykyinen tuotanto

Suunta käyttää tuotannon `BrowserEditor`-komponenttia muuttamattomana, ja sitä
ohjataan samalla logiikalla kuin `BrowserDocument`ia. Levyä esittää muuttuja,
jolla on sama tallennussääntö kuin daemonilla: tallennus menee läpi vain, jos
tiedoston versio on sama kuin avattaessa (`base_version`).

1. Kun agentti tallentaa, editorissa ei näy mitään.
2. Tallenna epäonnistuu viestiin "Tiedosto on muuttunut palvelimella. Oma teksti
   säilyy. Lue versio vertailuun ja sovita muutokset ennen tallennusta."
   Tallenna-painike jää pois käytöstä, eikä sen kohdalla kerrota syytä.
3. *Lue palvelimelta vertailuun* näyttää levyn tekstin editorin alla
   pelkkänä tekstinä. Eroja ei ole korostettu, eikä tekstissä sanota, että sen
   on muuttanut agentti.
4. *Käytä luettua versiota pohjana, säilytä oma teksti* kuulostaa
   yhdistämiseltä, mutta se vain hyväksyy levyn version pohjaksi ja jättää
   oman tekstisi ennalleen. Seuraava Tallenna kirjoittaa oman tekstisi levylle,
   ja **agentin muutokset katoavat tiedostosta** ilman mainintaa. Ne näkyvät
   enää keskustelun työkalukortissa.
5. *Hylkää muutokset ja lataa* kysyy vahvistuksen selaimen omalla
   ikkunalla ja korvaa oman tekstisi levyn versiolla.

Jarin havainto pitää siis paikkansa. Mitään ei häviä ilman painallusta, mutta
painike, jonka nimi lupaa säilyttää, johtaa agentin työn häviämiseen. Lisäksi
ihminen ei missään vaiheessa näe, mitä Tallenna tulee kirjoittamaan.

### Mitä suunnissa 1–3 on samaa

- Ilmoitus kertoo tekijän ja ajan ("Agentti muutti tätä tiedostoa 14.32") ja
  sanoo, ettei kumpikaan versio ole vielä kadonnut.
- Jos Tallenna tekee jotain muuta kuin tavallisen tallennuksen, sen nimi tai
  viereinen teksti kertoo sen (*Tallenna…*, *Tallenna ja korvaa agentin
  versio*, *Tallenna yhdistelmä*).
- Tallennuksen jälkeen kerrotaan, kenen muutokset ovat nyt tiedostossa.
- Jos editorissa ei ole tallentamattomia muutoksia, editori seuraa levyä
  hiljaa (suunnat 1 ja 3).

### Suunnat

Akseli: kuka sovittaa kaksi versiota yhteen ja milloin.

| Suunta | Milloin muutos huomataan | Mitä näytetään | Mitä Vertaa ja Tallenna tekevät | Hyöty | Hinta |
| --- | --- | --- | --- | --- | --- |
| **1. Valitse** | Heti agentin tallennuksen jälkeen | Ilmoitus ja *Vertaa versioita*. Vertailussa on kaksi kokonaista versiota rinnakkain (puhelimessa allekkain), ja muuttuneet rivit on korostettu. | Kun versioita on kaksi, Tallenna on *Tallenna…* ja avaa vertailun. *Pidä oma versio* (punainen) kertoo, että agentin 2 muutosta katoaa. *Ota agentin versio* hylkää omat muutoksesi, ja ne saa takaisin painikkeella *Palauta oma teksti*. | Yksinkertaisin ymmärtää, eikä yhdistämisalgoritmia tarvita. | Toinen versio hylätään aina kokonaan. Kahden pienen erillisen muutoksen takia ihminen joutuu luopumaan jommastakummasta tai kopioimaan käsin. |
| **2. Yhdistä** | Vasta Tallennettaessa, kuten nyt | Tallennus avaa luettelon kaikista muutoksista avaamisen jälkeen. Jokaisessa kortissa näkyy tekijä ja rivi. Samaa riviä koskevassa kortissa valitaan *Sinun / Agentin / Molemmat*. | Vertailu on tämä luettelo. *Tallenna yhdistelmä* kirjoittaa sen, mitä alareunan yhteenveto sanoo ("2 agentin muutosta ja 2 omaa muutosta"). Muutoksen voi jättää pois valintaruudulla. Painike on pois käytöstä, kunnes jokainen ristiriita on ratkaistu. | Ei tarvitse uutta tietoa hostilta. Kaikki on näkyvissä ennen kuin mitään kirjoitetaan. | Ihminen kirjoittaa vanhan version päälle tietämättään siihen asti, kun painaa Tallenna. Erillisetkin muutokset vaativat yhden käynnin luettelossa. |
| **3. Tuo heti** (suositus) | Heti agentin tallennuksen jälkeen | Agentin muutokset tulevat tekstiin vihreällä korostettuina, ja ilmoitus kertoo, että 2 muutosta tuotiin. Saman rivin ristiriita näkyy punaisena rivinä ja kolmena vaihtoehtona tekstin yllä. | Tallenna on tavallinen tallennus kaikesta, mitä editorissa näkyy. Se on pois käytöstä vain ratkaisemattoman ristiriidan aikana. *Peru tuonti* palauttaa oman tekstisi, ja silloin painike on punainen *Tallenna ja korvaa agentin versio*. | Erilliset muutokset eivät vaadi mitään. Ihminen näkee agentin työn siinä, missä se on. | Teksti muuttuu kesken kirjoittamisen. Tarvitsee hostilta tiedon agentin tallennuksesta ja kolmen version yhdistämisen. |

### Mitä hostilta oletetaan

- **Muutoksen huomaaminen heti (suunnat 1 ja 3).** Nyt editori huomaa
  muutoksen vasta, kun tallennus palaa `file_changed`-vastauksella. Selain saa
  jo keskustelusta agentin `edit`- ja `write`-työkalukutsut polkuineen, ja
  silloin editori voi lukea saman tiedoston uudelleen. Agentin bash-komento
  (`sed -i`, `git checkout`) tai muokkaus SSH:n kautta ei näy työkalukutsuna.
  Siksi tarvitaan lisäksi versiotarkistus, kun ikkuna saa fokuksen ja ennen
  tallennusta. Se on tavallinen tiedoston luku daemonista. Uutta tallennuspaikkaa
  tai tiedostojen seurantaa (inotify) ei tarvita.
- **Tekijä.** Editori voi sanoa "Agentti" vain, kun muutos liittyy työkalukutsuun.
  Muuten oikea teksti on "Tiedosto muuttui levyllä". Suunta 2 käyttää
  otsikossa tätä neutraalia muotoa.
- **Yhdistäminen (suunnat 2 ja 3).** Selaimella on jo kaikki kolme tekstiä:
  avattu versio (`doc.content`), oma puskuri ja uusi luku. Rivitason
  kolmen version yhdistäminen on prototyypissä omaa koodia (`diff.ts`).
  Tuotannossa se olisi pieni oma toteutus tai uusi riippuvuus. Riippuvuuden
  valinta on Jarin päätös.
- **Tallennussääntö säilyy.** Daemonin vertaus (`base_version`) pysyy
  ennallaan. Tuonnin jälkeen pohjana on agentin versio, joten kolmas
  tallennus tuonnin aikana huomataan samalla tavalla.
- **Peruminen.** Suunta 3 tuo muutokset yhtenä CodeMirror-muutoksena, joten
  kursori pysyy paikallaan ja Ctrl+Z peruu tuonnin. Prototyypin
  `cm.tsx` on tuotannon editori, johon on lisätty rivikorostukset ja tämä
  muutoksen tuonti.

### Puhelin

Tuotannossa puhelin näyttää editorin (40 %) keskustelun yläpuolella. Siinä
tilassa ilmoitus veisi suurimman osan editorista, joten kierros näyttää
editorin koko ikkunan tilassa. Tuotannon yhden sanan tilateksti mahtuu
työkaluriville, mutta pidemmät tekstit ("Muokattu · 1 ristiriita") on
kierroksessa siirretty omalle rivilleen. Muuten tiedostopolku puristui yhden
merkin levyiseksi.

### Kysymykset Jarille

1. Onko hyväksyttävää, että agentin muutokset tulevat tekstiisi kesken
   kirjoittamisen (Tuo heti)? Vai pitäisikö yhdistäminen tehdä vasta
   tallennettaessa (Yhdistä), vaikka muutos huomattaisiin heti?
2. Kun pidät oman versiosi agentin muutosten päälle, agentti ei tiedä, että sen
   työ korvattiin. Pitäisikö keskusteluun jäädä siitä merkintä?
3. Kelpaako neutraali "Tiedosto muuttui levyllä", kun muutos ei tullut agentin
   työkalusta?

### Tarkistus

`node design-system/prototypes/rounds/2026-10-24-rinnakkainen-muokkaus/build.mjs`
rakentaa sivun. `check.mjs <html|url> <hakemisto>` käy läpi neljä suuntaa
leveyksillä 1440 ja 390, vaaleana ja tummana, ja tarkistaa valitsimen jaetulla
`picker-check.mjs`:llä. Se myös klikkaa jokaisen polun läpi ja tarkistaa, mitä
levylle jäi: tuotannossa agentin muutokset katoavat, Yhdistä ja Tuo heti
säilyttävät molempien muutokset. Tulos oli 32 tarkistuspistettä ja puhdas konsoli sekä
paikallisesti että julkaistulla sivulla (`evidence/checks.json`,
`evidence/hosted-checks.json`). Kuvat ja HTML-tilannevedokset ovat
`evidence/`-hakemistossa.
