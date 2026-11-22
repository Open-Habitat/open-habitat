# Koko käyttöliittymän rakenne

## Saatesanat

Kysymys on, mikä on navigaatiota ja mikä työtä. Nykyisessä sivupalkissa kaikki
on samassa pinossa: palvelin, neljä paikkaa, haku, kolme tilaosiota ja
työtilat. Siksi kiinteä yläosa syö puolet tilasta. Yläpalkissa taas on kymmenkunta
pientä nimetöntä kuvaketta, jotka kuuluvat kolmelle eri tasolle: sovellukselle
(Selitä), työtilalle (editori, pääte, haara) ja keskustelulle (otsikko,
katsaus, arkistointi, tiedot).

Suosittelen **suuntaa 1, Kaksi tasoa**. Paikat ja työtilat menevät kapeaan
kaistaan vasemmalle, ja viereinen palsta jää kokonaan keskusteluille. Sinun
vuorosi, Käynnissä ja Hiljaiset ovat siinä yhtenä vierityksenä koko
korkeudelta, eivät kolmena pienenä laatikkona. Kannettavan 1280×720-näkymään
mahtuu 17 keskustelua ja kaikki 10 työtilaa, ja 1920×1080:ssa kaikki 22
keskustelua. Klikkaa työtilaruutua: palsta rajautuu siihen työtilaan, ja
otsikosta pääset työtilan sivulle. Yläpalkissa on enää otsikko, työtila, haara ja
tila sekä nimetyt **Editori** ja **Pääte**. Loput ovat `⋯`-valikossa.

Tuotokset, Oma selain ja Agentin käytössä saavat kaikissa suunnissa omat
kuvakkeensa ja saman muodon, eikä mikään niistä ole kortti
(`rail-icons-tuotokset-oma-selain`). Tämän keskustelun selainikkunat
avautuvat kentän yllä olevasta sirusta, kuten selainkierroksen suosituksessa.

Suunta 1 muuttaa kahta sovittua asiaa, ja ne kannattaa päättää tietoisesti.
Työtilat näkyvät nimirivien sijaan kirjainruutuina, ja nimi tulee vihjeestä ja
palstan otsikosta. Editori ja Pääte ovat nimettyjä painikkeita, vaikka
design.md:n mukaan kuvake voittaa. Juuri nimettömät kuvakkeet olivat kuitenkin
valituksesi aihe.

## Suunnat

Akseli: mihin kerrokseen kukin osa kuuluu. Sisältö on sama kaikissa: sama
keskustelu auki, 10 työtilaa ja 22 keskustelua. Rivimäärät on mitattu
selaimessa paljaasta sovelluksesta 1280×720:ssa, ja tarkistus kaatuu, jos
sivun ylärivin luku on eri.

| Suunta | Päätös | 1280×720 | Hinta |
| --- | --- | --- | --- |
| 1 Kaksi tasoa | Kaista paikoille ja työtiloille, palsta pelkille keskusteluille | 17 keskustelua + 10 työtilaa | Työtilat tunnistetaan kirjaimista ja väreistä; yli ~12 työtilaa vierii kaistassa |
| 2 Yläpalkki | Haku/komentopaletti, paikat ja tili koko leveyden yläpalkkiin; editori, pääte ja tiedot keskustelun välilehtinä | 11 keskustelua + 10 työtilaa | Yläpalkki vie 48 px pystytilaa; tili siirtyy pois sovitusta paikasta; välilehti piilottaa keskustelun editorin ajaksi |
| 3 Työtila kotina | Sivupalkissa vain työtilat; keskustelut työtilan välilehtinä; tilaosiot Huomio-ponnahduksessa | 3 keskustelua (välilehdet) + 10 työtilaa | Työtilojen yli kulkeva "mitä minulta odotetaan" on yhden klikkauksen takana; kumoaa product.md:n sivupalkin tilaosiot |

Täysi kartta (jokainen nykyinen osa → missä se kussakin suunnassa asuu) on
kierroksen `NOTES.md`:ssä ja sivulla Kartta-painikkeen takana.

## Mitä kannattaa yhdistää

- **Suunnasta 3:** editori, pääte ja tiedostot ovat *työtilan* työkaluja
  (product.md: "each workspace has a browser terminal … and a VS Code editor"),
  eivät keskustelun. Suunnan 1 yläpalkissa ne kannattaa ryhmitellä työtilan
  nimen ja haaran kanssa, erilleen keskustelun `⋯`:stä.
- **Suunnasta 2:** yksi haku, joka on myös komentopaletti (⌘K): keskustelut,
  työtilat ja komennot kuten Avaa pääte ja Tee tilannekatsaus. Silloin
  `⋯`-valikkoon jäävät komennot löytyvät myös näppäimistöltä.
- **Suunnasta 3:** työtilarivin tilamerkit (● odottaa, ◌ käynnissä
  lukuineen) toimisivat myös suunnan 1 ruuduissa pelkän numeron sijaan.

## Suhde rinnakkaisiin kierroksiin

- `rail-space-small-screens` tiivistää nykyisen sivupalkin. Se on pienempi
  askel samaan suuntaan. Jos valitset suunnan 1, sen ratkaisu paikkojen
  sijoittamiseen korvautuu kaistalla, mutta tiiviit rivit ja yhden vierityksen
  idea siirtyvät sellaisinaan palstaan. Jos haluat ensin pienen muutoksen,
  rail-space voi laskeutua ensin ja suunta 1 myöhemmin. Ne eivät ole
  ristiriidassa.
- `server-browser-entry-points` suositteli suuntaa Molemmat: sivupalkista koko
  oma selain ja sirusta tämän keskustelun ikkunat. Kaikki kolme suuntaa
  noudattavat sitä. Sivupalkin rivin paikka vain vaihtuu: suunnassa 1 kaista,
  suunnassa 2 yläpalkki ja suunnassa 3 paikkojen ruudukko.

## Questions for Jari

1. Valitaanko suunta 1 (Kaksi tasoa)? Vai painaako suunnan 3 työtilakeskeisyys
   enemmän kuin se, että kaikki odottava näkyy yhdellä silmäyksellä?
2. Kelpaavatko työtilat kirjainruutuina (vihjeenä nimi, palstan otsikossa
   nimi valittuna)? Vaihtoehto on leveämpi kaista lyhyillä nimillä, jolloin
   palsta kapenee noin 60 px.
3. Saavatko yläpalkin työkalut nimet (Editori, Pääte), vaikka design.md:n mukaan
   kuvake voittaa? Ehdotan sääntöä: pysyvät työkalut nimetään, harvinaiset
   toiminnot menevät `⋯`:n taakse, ja nimetön kuvake jää vain yleisiin merkkeihin
   (`+`, `×`, `⋯`).
4. Saako Selitä-tila (nyt yläpalkin `?`) siirtyä sovelluksen tasolle kaistan
   alaosaan, koska se selittää koko näkymän eikä vain keskustelua?

## Decisions for later review

- **Malli vain kentän rivillä.** Malli oli sekä yläpalkissa että kentässä.
  Kentän siru jäi, koska malli valitaan ennen ensimmäistä viestiä. Vaihtoehto
  oli pitää se otsikossa tilan vieressä.
- **Hiljaisten työtilarajaus (pillerit) korvautuu kaistan työtilaruudulla
  (suunta 1).** Ruutu rajaa koko palstan eikä vain Hiljaisia. Vaihtoehto on
  pitää pillerit Hiljaisten otsikossa. Yksi rajausmekanismi on selkeämpi.
- **Apulaiset pysyvät omina riveinään Käynnissä-osiossa** product.md:n
  mukaisesti, ja suunnassa 3 ne ovat omia välilehtiään. Taustatyön sirut
  kentän yllä (sovittu Merkit-palkki) eivät muuttuneet, joten niitä ei piirretty
  tähän keskusteluun, jossa ei ole apulaisia.
- **Tuotosten kuvake on julkaistu sivu ja nuoli ulos, Oma selain
  selainikkuna ja Agentin käytössä kilpi ja avaimenreikä.** Vaihtoehtoja oli
  pino arkkeja ja avain. Valitut kuvakkeet erottuvat toisistaan myös 16 px:n
  koossa.
- **Suunnan 3 välilehdet ovat käynnissä olevat ja kaksi viimeksi luettua.**
  Selaimen tapaan itse avatut ja suljetut välilehdet olisivat uusi
  laitekohtainen tila. Sitä ei keksitty tähän.
- **Tili jää suunnissa 1 ja 3 alareunaan sovitun mukaisesti.** Suunta 2
  siirtää sen oikeaan yläkulmaan, ja se on kerrottu suunnan ylärivillä.

## Toimitus ja näyttö

- Kierros: `design-system/prototypes/rounds/2026-11-22-ui-structure/`
  (`build.mjs`, `round.js`, `round.css`, `check.mjs`, `NOTES.md`). Kirjastoon
  ei koskettu.
- Rakennettu sivu: `/var/tmp/agent-keep/ui-structure-free-round/offline.html`
  (kopio worktreen `design-system/prototypes/dist/ui-structure/offline.html`:stä).
  Osoitevalinnat `?v=1|2|3&lang=fi|en&theme=light|dark|contrast&bare=1`.
- Tarkistuksen kuvat: `/var/tmp/agent-keep/ui-structure-free-round/check/`
  (suunta-leveys-teema-kieli, `*-palette` ja puhelimen `*-drawer`).
- `check.mjs`: mitatut rivit 1280×720 → 17+10, 11+10, 3+10. 54 yhdistelmää
  (3 suuntaa × fi/en × päivä/yö/kontrasti × 1280×720, 1920×1080, 390×844)
  läpäisty. Axe on puhdas 1280 px:ssä joka teemassa, konsoli puhdas, verkko
  estetty.
- Nykytilan lähteinä olivat tuotannon `WorkspaceRailView.tsx`, yläpalkin
  toimintojen nimet (`web/src/text/explainMode.ts`) ja Jarin kannettavan kuvat.
  Kuvia ei talletettu, ja kaikki prototyypin nimet ovat keksittyjä.

# Kierros 2

## Saatesanat

Kierroksen 1 suunnat siirtelivät samoja osia paikasta toiseen. Tällä kertaa
lähdin liikkeelle siitä, mitä Habitatissa tehdään ja kuinka usein. Tila ja
näkyvyys jaetaan saman järjestyksen mukaan.

**Mitä Habitatissa tehdään.** Lähteinä olivat product.md, design.md,
tuotannon kehys (`WorkspaceRailView`, `NowSections`, `QuietSection`,
`NextWaitingDock`, ⌘K-vaihtaja), Etusivu, Tuotokset, Oma selain, asetukset,
apulaiset, editori, pääte ja Selitä-tila.

| Kuinka usein | Työ | Mitä se tarvitsee näytöltä |
| --- | --- | --- |
| Jatkuvasti | Keskustelun lukeminen ja siihen vastaaminen. Tieto siitä, kenen vuoro on, myös muissa työtiloissa | Leveä ja korkea keskustelu. Sinun vuorosi ja Käynnissä yhdellä silmäyksellä |
| Usein | Siirtyminen seuraavaan odottavaan, uuden keskustelun aloitus, vilkaisu käynnissä olevaan | Yksi klikkaus tai näppäin. Työtilan nimi, jotta tietää, mihin hyppää |
| Joskus | Toiseen työtilaan ja sen hiljaisiin keskusteluihin siirtyminen, Tuotokset, Oma selain, editori, pääte, Etusivu | Löytyy kahdella klikkauksella, mutta ei vie tilaa |
| Harvoin | Asetukset, Agentin käytössä, ylläpito, uusi työtila, arkistointi, Selitä | Valikossa tai kuvakkeena |

Nykyinen sivupalkki ei noudata tätä järjestystä. Sen ylimpinä ovat palvelin
ja neljä paikkaa, eli harvinaisia ja satunnaisia töitä, ja vasta niiden alla on
kenen vuoro. Lisäksi Hiljaiset ja Työtilat ovat kaksi eri listaa samasta
puusta.

**Mittaus muutti ajatteluni.** Keskustelupalsta on enintään 760 px leveä.
1280 px:n ikkunassa 280 px:n sivupalkki vie vain tyhjää marginaalia, ja
keskustelu on täsmälleen yhtä leveä sivupalkin kanssa ja ilman sitä (suuntien 1
ja 2 kuvat 1280×720). Leveys alkaa loppua vasta noin 1090 px:n kohdalla.
Niukka resurssi on korkeus: 720 px:n näytössä jokainen vaakapalkki on pois
keskustelusta. Siksi navigaatio kuuluu sivulle eikä ylös, eikä sitä kannata
piilottaa leveällä näytöllä. Kapealla näytöllä piilottaminen kannattaa.

**Mikä kierroksessa 1 meni pieleen.** Arvaukseni ovat nämä:

- *Kirjainruudut piilottivat työtilojen nimet* (suunta 1). Nimi on tunniste,
  jota verrataan terminaaliin, eikä kaksi kirjainta korvaa sitä.
- *Lisää kehystä eikä vähemmän.* Suunta 1 toi toisen palstan (64 + 272 px),
  suunta 2 koko leveyden yläpalkin ja välilehdet, ja suunta 3 välilehtirivin.
  Mikään suunta ei poistanut mitään.
- *Rakenne palveli puuta eikä työtä.* Suunta 3 järjesti kaiken työtiloittain,
  vaikka jatkuva kysymys on työtilojen yli kulkeva "mikä odottaa minua".
- *Väärä mittari.* Laskin, montako riviä mahtuu, en sitä, montako
  tarpeellista riviä mahtuu tai kuinka paljon keskustelu saa tilaa.
- Ehkä myös se, että kaikki kolme suuntaa olivat saman idean muunnelmia
  (missä mikin asuu), eivätkä ne kysyneet, tarvitaanko navigaatiota näkyviin
  lainkaan.

**Miten vertailukohdat ratkaisevat tämän.** Mukana ovat vain mallit, ei
ulkoasu.

- *Slack* pitää pysyvästi näkyvissä lukemattomat ja Activity-jonon, ja
  työtilan vaihto on kapean kaistan takana. Uudistuksen jälkeen kaistaa on
  moitittu kehyksen lisäämisestä. Kanavapuu on pitkä, ja ⌘K on sen oikotie.
- *Linear*: Inbox ja My issues ylimpänä, tiimit taitettavina puina niiden
  alla, ⌘K kaikkeen. Sivupalkin voi piilottaa kokonaan.
- *Claude.ai ja ChatGPT*: yksi aikajärjestetty keskustelulista, projektit
  omana osionaan, kapea keskitetty palsta. Sivupalkin voi piilottaa, ja
  kapealla näytöllä se tulee päälle.
- *Cursor ja VS Code*: kaikki paneelit voi avata ja sulkea, ⌘P avaa
  tiedoston ja ⌘⇧P komennon. Zen-tilassa jää vain sisältö.
- *Arc*: sivupalkki piiloutuu ja tulee esiin kutsuttaessa, ja komentorivi
  korvaa osoiterivin.
- *Superhuman*: ei pysyvää puuta. Yksi jono, ja toiminnon jälkeen siirrytään
  automaattisesti seuraavaan. Komennot ⌘K:lla.
- *Things*: Inbox, Today ja Upcoming ylimpinä, alueet ja projektit alla.
  Hiljainen ja tiivis.

Yhteiset mallit: **(a)** yksi huomiojono on aina näkyvissä tai yhden
painalluksen päässä, **(b)** iso puu on taitettuna tai vaihtajan takana,
**(c)** haku ja komennot ovat sama pinta, **(d)** toiminnon jälkeen pääsee
suoraan seuraavaan, ja **(e)** kapealla näytöllä navigaatio tulee sisällön
päälle eikä kavenna sitä.

## Suunnat

Akseli: millä navigaatio vastaa kysymykseen "kenen vuoro, ja minne
seuraavaksi". Vaihtoehdot ovat pysyvä lista, kutsuttava pinta ja esikatselu.
Sisältö on sama kaikissa: sama keskustelu auki, 10 työtilaa ja 22
keskustelua. Rivimäärät on mitattu selaimessa.

| Suunta | Idea | 1280×720 | Hinta |
| --- | --- | --- | --- |
| 1 Jono | Yksi pysyvä sivupalkki käyttötiheyden järjestyksessä: kenen vuoro ylimpänä, työtila joka rivillä, sitten työtilat nimineen. Hiljaiset avautuvat työtilan alle. Paikat ja tili yhdellä kuvakerivillä | 6 keskustelua + 10 työtilaa: kaikki odottava ja kaikki nimet | Hiljaisia ei näe yhtenä aikajärjestettynä listana, ja product.md:n Hiljaiset-lista lajitteluineen poistuu |
| 2 Kutsuttava | Ei pysyvää navigaatiota. Yläpalkin `● 3 ◌ 3` avaa navigaattorin, joka on myös haku (⌘K). Seuraava vie suoraan seuraavaan odottavaan. Voi kiinnittää | 0 + 0, kutsuttuna 6 + 10 | 1280 px:n näytöllä keskustelu ei saa yhtään lisää leveyttä. Käynnissä olevien nimet vaativat klikkauksen |
| 3 Katsaukset vierellä | Sivupalkki on kapea Etusivu: jokainen odottava kertoo, mitä agentti haluaa. Työtila on rajausvalikko | 7 keskustelua + 0 työtilaa | Kortit vievät rivejä, ja työtilan vaihto on valikon takana. 340 px kaventaa keskustelua jo noin 1150 px:n kohdalla |

Täysi kartta (jokainen nykyinen osa ja missä se kussakin suunnassa asuu) on
kierroksen `NOTES.md`:ssä ja sivulla Kartta-painikkeen takana. Puhelimen
muodot on luonnosteltu `NOTES.md`:hen.

## Suositus

Suosittelen **suuntaa 1, Jono**, ja siihen **suunnan 2 Seuraava-painiketta**
sekä kutsuttavaa navigaattoria kapean näytön muodoksi.

- Jono vastaa jatkuvaan kysymykseen pysyvästi ja maksaa siitä vain
  marginaalin, joka 1280 px:n näytöllä on joka tapauksessa tyhjä. Se ei lisää
  yhtään vaakapalkkia. Kaikki odottava ja kaikki kymmenen työtilaa nimineen
  näkyvät 1280×720:ssä vierittämättä.
- Se poistaa kaksi kerrosta: paikkojen neljä riviä (nyt yksi kuvakerivi) ja
  erillisen Hiljaiset-listan (nyt työtilan alla). Nykyiseen verrattuna se on
  vähennys eikä uusi rakenne.
- Seuraava on Superhumanin "siirry seuraavaan" -malli, ja tuotannossa on jo
  sen siemen (`NextWaitingDock`). Yläpalkissa se toimii samoin kaikilla
  leveyksillä.
- Kapealla näytöllä, alle noin 1090 px, ja puhelimessa sivupalkki muuttuu
  suunnan 2 navigaattoriksi: sama sisältö, kutsutaan `● 3 ◌ 3`:sta tai ⌘K:lla.
- Suunnan 3 kortit (mitä agentti haluaa) kuuluvat Etusivulle, jossa ne jo
  ovat katsauksina, eivät sivupalkkiin.

**Kierroksesta 1 jää eloon** ⌘K-paletti haun ja komentojen yhteisenä
pintana (suunta 2) sekä työtilarivin tilamerkit `● n ◌ n` (suunta 3).
Kirjainruutuja, yläpalkkia ja välilehtiä ei jatketa.

## Suhde rinnakkaisiin kierroksiin

- `rail-space-small-screens` (kierros 2, mukautuva sivupalkki) ratkaisee,
  miltä sivupalkki näyttää eri leveyksillä. Jono ratkaisee, mitä siinä on ja
  missä järjestyksessä. Ne sopivat yhteen: mukautuvan sivupalkin kuvakerivi,
  joka saa leveämmällä näytöllä nimet, on juuri Jonon alarivi, ja kapein muoto
  on suunnan 2 navigaattori. Jos rail-spacen ratkaisu laskeutuu ensin, Jono on
  sen jälkeen sisällön uudelleenjärjestys eikä uusi kehys.
- `server-browser-entry-points` (kierros 3) noudattaa Jarin päätöstä, jonka
  mukaan selain on vain sivupalkissa. Jonossa toisen keskustelun selainpyyntö
  näkyy kahdessa paikassa: Oma selain -kuvakkeen merkkinä ja selainkuvakkeena
  sen keskustelun omalla rivillä. Kentän yllä ei ole sirua. Kierros 3 päättää,
  miltä nämä näyttävät; Jono antaa niille paikan.

## Questions for Jari

1. Valitaanko suunta 1 (Jono) pohjaksi, suunnan 2 Seuraava-painike mukaan, ja
   navigaattori kapean näytön muodoksi?
2. Saako Hiljaiset-lista poistua erillisenä listana ja siirtyä työtilojen alle?
   Tämä muuttaa product.md:tä: nyt Hiljaiset on yksi uusin ensin -lista, jota
   voi lajitella ja rajata. Vaihtoehto on pitää Hiljaiset taitettuna osiona
   Käynnissä-osion alla, jolloin 1280×720:ssä työtilarivejä jää noin kaksi
   vähemmän.
3. Kelpaavatko Tuotokset, Oma selain, Agentin käytössä ja Selitä kuvakkeina
   yhdellä rivillä tilin vieressä, kun merkki kertoo uutuudet? Leveällä
   näytöllä ne voivat saada nimet rail-spacen mukautuvan sivupalkin tapaan.
4. Pitäisikö Seuraava-painikkeen kulkea vain Sinun vuorosi -listaa, kuten
   prototyypissä, vai myös juuri valmistuneita Käynnissä-keskusteluja?

## Decisions for later review (kierros 2)

- **Työtilarivin klikkaus avaa sen hiljaiset paikallaan eikä vie työtilan
  sivulle.** Sivulle vie avatun työtilan viimeinen rivi. Vaihtoehto oli nimi
  linkkinä ja erillinen nuoli avaamiseen, kuten nykyisessä design.md:ssä.
  Valitsin yhden klikkauskohteen, koska avaaminen on yleisempää kuin sivu.
- **Jonon riveillä on aika poissa, ja sen paikalla on työtilan nimi.**
  Avatun työtilan hiljaisilla riveillä ja suunnan 3 korteilla aika näkyy.
  Työtilan nimi auttaa päättämään, minne hypätä, enemmän kuin "12 min".
- **Epäonnistunut keskustelu näkyy punaisena merkkinä työtilarivillä**,
  koska erillistä Hiljaiset-listaa ei ole. Vaihtoehto oli nostaa se
  Käynnissä-osioon. Se olisi kuitenkin kumonnut product.md:n säännön, jonka
  mukaan virheeseen päättynyt vuoro on hiljainen.
- **Editori, Pääte ja `⋯` ovat kuvakkeina** design.md:n säännön mukaan,
  koska kierroksen 1 kysymykseen 3 ei vastattu. Ne eivät ole tämän
  kierroksen akseli.
- **Kentän yllä ei ole selainsirua**, koska selainkierroksen 2 päätöksen
  mukaan selain on vain sivupalkissa.
- **Selitä on paikkojen rivillä `?`-kuvakkeena** eikä keskustelun
  yläpalkissa, koska se selittää koko näkymän.
- **Suunnan 2 kiinnitys on laitekohtainen näkymävalinta** kuten Hiljaisten
  taittaminen nyt. Host ei tallenna sitä.
- **Suunnassa 2 palvelimen nimi näkyy vain vihjeessä.** Navigaattorin
  ylärivillä on hakukenttä, koska haku on sen tarkoitus.
- **Uusi keskustelu on ylärivin kynä.** Työtilan valinta tapahtuu samoin kuin
  nyt, eikä sitä piirretty.

## Toimitus ja näyttö (kierros 2)

- Kierros: `design-system/prototypes/rounds/2026-11-22-ui-structure-2/`
  (`build.mjs`, `round.js`, `round.css`, `check.mjs`, `NOTES.md`). Kirjastoon
  ei koskettu.
- Rakennettu sivu: `/var/tmp/agent-keep/ui-structure-free-round/round2-offline.html`
  (kopio worktreen `design-system/prototypes/dist/ui-structure-2/offline.html`:stä).
  Osoitevalinnat: `?v=1|2|3&lang=fi|en&theme=light|dark|contrast&bare=1`.
- Tarkistuksen kuvat: `/var/tmp/agent-keep/ui-structure-free-round/round2-check/`.
  Kuvat on nimetty suunta-leveys-teema-kieli, ja lisäksi on `*-navigator`,
  `*-pinned`, `*-expanded`, `*-filtered`, `*-palette` ja puhelimen `*-drawer`.
- `check.mjs` mittasi 1280×720:ssä 6+10, 0+0 (kutsuttuna 6+10) ja 7+0
  riviä. Kaikki 54 yhdistelmää läpäistiin (3 suuntaa × fi/en ×
  päivä/yö/kontrasti × 1280×720, 1920×1080, 390×844). Axe ei löytänyt
  virheitä 1280 px:ssä missään teemassa, suunnassa 2 myös navigaattori auki.
  Konsoli oli puhdas, ja verkko oli estetty.
