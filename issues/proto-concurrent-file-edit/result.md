# Rinnakkainen muokkaus · kierros 1

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

## Suunta 0 · Nykyinen tuotanto

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

## Mitä suunnissa 1–3 on samaa

- Ilmoitus kertoo tekijän ja ajan ("Agentti muutti tätä tiedostoa 14.32") ja
  sanoo, ettei kumpikaan versio ole vielä kadonnut.
- Jos Tallenna tekee jotain muuta kuin tavallisen tallennuksen, sen nimi tai
  viereinen teksti kertoo sen (*Tallenna…*, *Tallenna ja korvaa agentin
  versio*, *Tallenna yhdistelmä*).
- Tallennuksen jälkeen kerrotaan, kenen muutokset ovat nyt tiedostossa.
- Jos editorissa ei ole tallentamattomia muutoksia, editori seuraa levyä
  hiljaa (suunnat 1 ja 3).

## Suunnat

Akseli: kuka sovittaa kaksi versiota yhteen ja milloin.

| Suunta | Milloin muutos huomataan | Mitä näytetään | Mitä Vertaa ja Tallenna tekevät | Hyöty | Hinta |
| --- | --- | --- | --- | --- | --- |
| **1. Valitse** | Heti agentin tallennuksen jälkeen | Ilmoitus ja *Vertaa versioita*. Vertailussa on kaksi kokonaista versiota rinnakkain (puhelimessa allekkain), ja muuttuneet rivit on korostettu. | Kun versioita on kaksi, Tallenna on *Tallenna…* ja avaa vertailun. *Pidä oma versio* (punainen) kertoo, että agentin 2 muutosta katoaa. *Ota agentin versio* hylkää omat muutoksesi, ja ne saa takaisin painikkeella *Palauta oma teksti*. | Yksinkertaisin ymmärtää, eikä yhdistämisalgoritmia tarvita. | Toinen versio hylätään aina kokonaan. Kahden pienen erillisen muutoksen takia ihminen joutuu luopumaan jommastakummasta tai kopioimaan käsin. |
| **2. Yhdistä** | Vasta Tallennettaessa, kuten nyt | Tallennus avaa luettelon kaikista muutoksista avaamisen jälkeen. Jokaisessa kortissa näkyy tekijä ja rivi. Samaa riviä koskevassa kortissa valitaan *Sinun / Agentin / Molemmat*. | Vertailu on tämä luettelo. *Tallenna yhdistelmä* kirjoittaa sen, mitä alareunan yhteenveto sanoo ("2 agentin muutosta ja 2 omaa muutosta"). Muutoksen voi jättää pois valintaruudulla. Painike on pois käytöstä, kunnes jokainen ristiriita on ratkaistu. | Ei tarvitse uutta tietoa hostilta. Kaikki on näkyvissä ennen kuin mitään kirjoitetaan. | Ihminen kirjoittaa vanhan version päälle tietämättään siihen asti, kun painaa Tallenna. Erillisetkin muutokset vaativat yhden käynnin luettelossa. |
| **3. Tuo heti** (suositus) | Heti agentin tallennuksen jälkeen | Agentin muutokset tulevat tekstiin vihreällä korostettuina, ja ilmoitus kertoo, että 2 muutosta tuotiin. Saman rivin ristiriita näkyy punaisena rivinä ja kolmena vaihtoehtona tekstin yllä. | Tallenna on tavallinen tallennus kaikesta, mitä editorissa näkyy. Se on pois käytöstä vain ratkaisemattoman ristiriidan aikana. *Peru tuonti* palauttaa oman tekstisi, ja silloin painike on punainen *Tallenna ja korvaa agentin versio*. | Erilliset muutokset eivät vaadi mitään. Ihminen näkee agentin työn siinä, missä se on. | Teksti muuttuu kesken kirjoittamisen. Tarvitsee hostilta tiedon agentin tallennuksesta ja kolmen version yhdistämisen. |

## Mitä hostilta oletetaan

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

## Puhelin

Tuotannossa puhelin näyttää editorin (40 %) keskustelun yläpuolella. Siinä
tilassa ilmoitus veisi suurimman osan editorista, joten kierros näyttää
editorin koko ikkunan tilassa. Tuotannon yhden sanan tilateksti mahtuu
työkaluriville, mutta pidemmät tekstit ("Muokattu · 1 ristiriita") on
kierroksessa siirretty omalle rivilleen. Muuten tiedostopolku puristui yhden
merkin levyiseksi.

## Kysymykset Jarille

1. Onko hyväksyttävää, että agentin muutokset tulevat tekstiisi kesken
   kirjoittamisen (Tuo heti)? Vai pitäisikö yhdistäminen tehdä vasta
   tallennettaessa (Yhdistä), vaikka muutos huomattaisiin heti?
2. Kun pidät oman versiosi agentin muutosten päälle, agentti ei tiedä, että sen
   työ korvattiin. Pitäisikö keskusteluun jäädä siitä merkintä?
3. Kelpaako neutraali "Tiedosto muuttui levyllä", kun muutos ei tullut agentin
   työkalusta?

## Tarkistus

`node design-system/prototypes/rounds/2026-10-24-rinnakkainen-muokkaus/build.mjs`
rakentaa sivun. `check.mjs <html|url> <hakemisto>` käy läpi neljä suuntaa
leveyksillä 1440 ja 390, vaaleana ja tummana, ja tarkistaa valitsimen jaetulla
`picker-check.mjs`:llä. Se myös klikkaa jokaisen polun läpi ja tarkistaa, mitä
levylle jäi: tuotannossa agentin muutokset katoavat, Yhdistä ja Tuo heti
säilyttävät molempien muutokset. Tulos oli 32 tarkistuspistettä ja puhdas konsoli sekä
paikallisesti että julkaistulla sivulla (`evidence/checks.json`,
`evidence/hosted-checks.json`). Kuvat ja HTML-tilannevedokset ovat
`evidence/`-hakemistossa.
