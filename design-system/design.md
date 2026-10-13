# Käyttöliittymän design

Open Habitatissa käyttäjä lukee agenttikeskustelua ja seuraa sen työtä.
Keskustelu on pääsisältö; rauhallinen navigaatio, tilamerkit ja toiminnot
auttavat löytämään olennaisen keskeyttämättä lukemista. Käyttöliittymä toimii
työpöydällä ja puhelimessa, vaaleana ja tummana.

[Vedokset](drafts/) näyttävät sommittelun ja esitystilat. Navigaation,
paluunäkymän, työtilasivun ja asetusten viite on
[Navigaatio ja asetukset](drafts/Navigaatio%20ja%20asetukset.dc.html).
[Kontrollitilat ja agentin tila](drafts/Kontrollitilat%20ja%20agentin%20tila.dc.html)
kuvaa yhteisen tilojen esityskielen. Vedosten ehdollisten tilojen näyttäminen
edellyttää niitä tukevia tietoja hostilta.

[Tuotekuvaus](../docs/product.md) kertoo käyttökulut ja toiminnan rajat.
Tämä sivu kuvaa niiden visuaalisen esityksen. Yhteiset värit, mitat, fontit ja
liike ovat [tokeneissa](tokens/).

## Ilme ja luettavuus

Oletustila on hiljainen. Näkymässä on yksi ensisijainen toiminto kerrallaan;
toissijaiset toiminnot ovat hillittyjä. Reunat erottavat pinnat, ja varjot
kuuluvat kelluviin valikoihin, laatikoihin ja viimeisimpään vievään painikkeeseen.
Kopiointi näkyy hiljaisena toimintona viestin tai koodilohkon yhteydessä.

Käyttöliittymä on suomeksi. Instrument Sans on ihmisen tekstille ja JetBrains
Mono poluille, komennoille, repoille ja muille koneellisille tunnisteille.
Tunnisteet säilyvät siinä muodossa, jossa käyttäjä kohtaa ne terminaalissa.
Fontit tulevat tuotteen mukana, ja yhteiset ikonit pitävät ulkonäön samana
käyttöjärjestelmästä riippumatta.

Toiminnot ja tilat näytetään ikoneilla ja pienillä graafisilla merkeillä
aina kun merkitys on tunnistettava: uusi keskustelu "+", päivitys kahtena
kiertävänä nuolena, sulkeminen, arkistointi, tiedot ja tila. Tekstipainike
on poikkeus, ei oletus. Pelkällä ikonilla on aina saavutettava nimi ja
vihjeteksti (Jari 12.10.2026).

Järjestelmäteema on oletus; käyttäjä voi valita myös vaalean tai tumman teeman.
Fokus näkyy molemmissa teemoissa. Vähennetyn liikkeen asetus poistaa pulssit ja
siirtymät, joten liike täydentää tekstillä tai merkillä kerrottua tietoa.
Pitkä teksti ja zoomaus saavat kasvattaa sisältöä peittämättä toimintoja.

## Tilat ja toimintojen palaute

Agentin aktiivisuus, uuden vastauksen tai virheen vaatima huomio,
kirjoitusoikeus ja operaation tulos esitetään erikseen, koska ne voivat olla
voimassa samanaikaisesti. Merkki, sana ja väri tekevät tilasta tunnistettavan
myös ilman liikettä tai värien erottamista.

Odottaa tarkoittaa avointa agenttia, joka odottaa käyttäjän vastausta; sen
merkki on ontto rengas. Keskustelussa käynti poistaa huomiomerkinnän mutta
jättää agentin odottamaan. Valmis tarkoittaa suljettua agenttia. Jos sulkemista
ei tiedetä, esitetään tuntematon tila. Vain luku näkyy omana katkoviivatagina
tai kentän katkoviivareunana. Palveluvirhe näytetään vain raportoidun virheen
perusteella.

Nykyinen navigaatiokohde erottuu neutraalilla pinnalla. Hover ja painallus
syventävät toiminnon sävyä, jotta niitä ei sekoiteta valintaan. Estetty
kontrolli säilyy luettavana. Epäselvän eston, kuten yhteyskatkon tai
kirjoitusoikeuden puutteen, syy kerrotaan kontrollin yhteydessä myös puhelimessa
ja avustavalle teknologialle. Ilmeinen tyhjän kentän lähetysesto ei tarvitse
toistuvaa ohjetta. Estetyn kontrollin fokusoitavuus määräytyy sen toiminnan
mukaan. Pikanäppäinten ohje kuuluu omaan vihjeriviinsä.

Odottavan toiminnon teksti kertoo, mitä odotetaan, ja säilyttää kontrastinsa.
Vahvistettu onnistunut lähetys tai tyhjä jono ei jätä pysyvää ilmoitusta.
Epävarma lähetys näkyy hillittynä katkoviivalaatikkona ja lyhyenä
lähetysvirheenä: viestin toimitusta ei vielä tiedetä. Vahvistettu virhe
erottuu epävarmasta tuloksesta. Sovelluksen yhteyskatkos näkyy yhdessä
yläreunan ilmoituksessa, ja aiempi sisältö jää luettavaksi.

## Sovelluskehys

Sivupalkin Etusivu vie paluunäkymään: ensin ovat uudet huomiota vaativat
keskustelut, sitten käynnissä olevat ja viimeksi avatut. Nähty virhe säilyy
keskustelurivillä ilman että se jää etusivun kärkeen.

Työtilat ryhmittelevät keskustelut. Työtilan sisällä ensin ovat uudet,
uuden vastauksen saaneet, työskentelevät ja odottavat keskustelut; valmiit
taittuvat yhden "Valmiit"-rivin taakse. Keskustelu on yksi rivi: otsikko ja
tilamerkki oikealla (Jari 13.10.2026). Työtilan nimi avaa sen oman sivun;
erillinen nuoli avaa ja sulkee sivupalkin ryhmän. Työtilasivulla näkyvät nimi,
polku, uuden keskustelun aloitus ja keskustelut. Sivupalkin voi kaventaa
kaistaksi, jossa keskeiset toiminnot säilyvät saatavilla. Puhelimessa sama
navigaatiosisältö avautuu valikkolaatikkoon keskustelun päälle.

Tilipainikkeessa näkyvät etunimi ja profiilikuva tai sen varaesitys.
Avattu tilinäkymä näyttää sähköpostin. Asetusten osiot ovat Tili,
Yhteydet tällä palvelimella, Ulkoasu ja Istunto.

## Keskustelun arkisto

Työtilasivulla arkistoidut keskustelut löytyvät erillisestä Arkisto-osiosta,
eivät tavallisesta keskustelulistasta. Arkistointi vahvistetaan keskustelussa;
palautus muuttaa näkyvyyttä mutta ei aloita Pi:tä. Erillinen Jatka-toiminto
käyttää samaa natiivia historiaa. Aktiivinen kirjoittaja estää arkistoinnin.
Tuntematon arkiston tila näytetään varoituksena, eikä sitä tulkita tyhjäksi
arkistoksi. `ArchiveControls` on yhteinen tuotanto- ja katalogikomponentti;
konflikti- ja tuntematon-tilan esimerkit ovat `ConversationStates.stories.tsx`:ssä.

## Keskustelu

Keskustelun yläpalkissa ovat otsikko, työtilan nimi, olennainen tila ja
oikeassa reunassa keskustelun toiminnot näkyvinä ikoneina: uusi otsikko
(kursiivi serif-H, jonka nurkassa päivityksen kaksi kiertävää nuolta), arkistointi ja tiedot.
Tiedot avautuvat ponnahdusikkunaan, ja arkistointi vahvistetaan
valintaikkunassa. Tyhjässä keskustelussa uusi otsikko on estetty, ja
kuten arkistoinnin esto työn aikana, se kertoo syynsä. Puhelimessa tila näkyy pelkkänä merkkinä
(Jari 13.10.2026, [Agentin vuoro](drafts/Agentin%20vuoro.proto.html)). Viestit, työkalurivit ja kirjoituskenttä
noudattavat yhteistä palstaa. Viimeisimpään-painike pysyy näkyvänä myös
kirjoituskentän kasvaessa. Taustapäivitys säilyttää lukukohdan ja fokuksen
sekä jättää luettavan sisällön näkyviin.

Tilannekatsaus on oma korttinsa suoraan kirjoituskentän yllä: otsakkeessa
ikä ja merkki uusista viesteistä, oikealla päivitys ja sulkeminen. Suljettu
katsaus pysyy kiinni, kunnes syntyy uudempi (Jari 13.10.2026).

Levossa kirjoituskenttä on yksirivinen ja Lähetä-ikoni on sen vieressä;
kenttä kasvaa tekstin mukana noin kahteentoista riviin ja vierittyy sitten.
Pi:n työn ajan kentän alle tulee rivi, jossa vasemmalla on Stop ja oikealla
valinta Ohjaa / Työn jälkeen; Lähetä tekee valitun. Stop pysäyttää heti ilman
vahvistusta, koska agentin saa jatkamaan pyytämällä. Valinnan vihjeteksti
kertoo ohjaamisen ja työn jälkeen lähtevän viestin eron; pikanäppäinten
ohjeriviä kentän alla ei ole (Jari 13.10.2026). Jonot ovat tiiviitä rivejä, joilla on yhteinen otsake ja koko
jonon tyhjennys. Hylätty lähetys jättää tekstin korjattavaksi; epävarman
lähetyksen yhteydessä tekstin voi ottaa talteen.

[Pi-keskustelun lohkot](drafts/Pi-keskustelun%20lohkot.dc.html) näyttää
sovitun sisältöjen esityskielen, ja
[Agentin vuoro](drafts/Agentin%20vuoro.proto.html) agentin vuoron rakenteen,
joka korvaa sen kuplattoman vastauksen ja supistetun ajattelun: vuoro on
pystylanka, jonka pää on "PI · malli" kerran per vastaus ja samalla työn
avausnappi; käyttäjän ja agentin viestit ovat kuplia, joilla on samanmuotoinen
ylärivi; yksirivinen ajattelu näkyy rivillään ilman avausta. Työn aikana
elävyys on yhdessä tilanauhassa langan lopussa (mitä agentti tekee ja kauanko
on kestänyt), ja valmistuttuaan nauha on rivi, josta työn saa kiinni.
Bash-kortissa näkyvät komento ja tuloste ilman otsakkeita; pitkä komento
näyttää ensimmäisen rivinsä ja pitkä tuloste alun ja lopun, sivupalkin
painikkeilla alkuun, loppuun, kokonaan tai omaan ikkunaan; oma ikkuna
tarjotaan aina, kun tuloste on yli kymmenen riviä (Jari 12.10. ja 13.10.2026).
Työkalurivin otsakkeessa työkalun nimi näkyy aina kokonaan, ja komento tai kohde pysyy yhdellä rivillä ja päättyy tarvittaessa "…"-merkkiin; koko komento näkyy avatussa kortissa (Jari 13.10.2026). Sivupalkin ylimpänä on tulosteen kopiointi, myös lyhyellä tulosteella. Kun
keskustelu avataan ja ladataan, sen bash-kortit ovat kiinni; auki ovat vain
katselun aikana saapuvat, ja juuri katsotun keskustelun avaukset säilyvät
(Jari 13.10.2026). Koodissa ja tulosteissa ei ole fontin ligatuureja, jotta
näkyvä teksti on sama kuin kopioitu.
Langan pää "PI · malli" on avausnappi, jossa on sama väkänen kuin
työkaluriveillä, ja alun ja lopun välinen rivi on katkoviivallinen saumarivi
laatikon sisällä, ei oma painikemöykky. Pi:n järjestetty teksti, luettava ajattelu ja työkalut muodostavat
yhden vastaukseen päättyvän langan myös peräkkäisissä agentin vuoroissa. PI-otsake ei toistu
jokaisen osan edessä. Työkalun kutsu, eteneminen ja tallennettu tulos ovat
yksi avattava käyttö samassa kohdassa; `toolCallId` yhdistää ne. Käyttäjän
paikallinen komento erottuu Pi:n pyytämästä bash-työkalusta. Peräkkäisten
työkalujen ryhmittely ja `edit`-diffi ovat myöhempää työtä; siihen asti edit
näyttää sallitut argumentit. Pitkä käyttäjän viesti supistuu kahdeksaan
riviin, mutta sen saa auki kokonaan.

Malli ja ajattelutaso ovat yläpalkissa yhtenä merkkinä (esim. "gpt-5.5 · high"),
joka avaa tiedot; tiedoissa on mallin koko tunniste kopioitavana ja
ajattelutaso. Keskustelussa Pi:n omat asetusmerkinnät ovat yhtä hillittyä
riviperhettä: alussa yksi rivi, jossa ovat malli ja ajattelutaso (ei
"vaihtui", koska kyse on alkutilasta; eri aikaan saapuvat merkinnät täydentävät
samaa riviä), ja myöhemmät mallin tai ajattelutason muutokset sekä
tiivistys samanlaisina riveinä vanhasta uuteen. Kopiointi on ikoni. Pi:n
keskustelun nimimerkintöjä ("Keskustelun tieto") ei näytetä, koska otsikko on
yläpalkissa. Valmiin säikeen yhteenveto ("1 ajatusta · 2 työkalua") ja kesto
ovat säikeen alussa PI-rivillä, josta työn saa kiinni; säikeen loppuun ei
tule yhteenvetoriviä (Jari 13.10.2026). Tyhjässä keskustelussa ei ole
säilytettävää, joten arkistoinnin tilalla on Sulje, joka poistaa keskustelun
heti ilman vahvistusta (Jari 13.10.2026).

Keskustelun sisältö esitetään samalla tavalla historiassa ja reaaliajassa.
Esikatselun raja, Pi:n vahvistettu katkaisu, pituusraja ja keskeytys
näytetään toisistaan erillisinä. Rajattua sisältöä voi lukea paikallaan
rajatulla natiivilohkoluvulla. Bash-tuloste seuraa loppua työn aikana ja valmistuttuaan näyttää yli
kymmenen rivin tulosteesta kolme ensimmäistä ja seitsemän viimeistä;
muiden työkalujen esikatselu alkaa alusta. Käyttäjän Alku/Loppu-valinta
muistetaan **työkalukohtaisesti**, mutta se ei muuta itse tulosta.
Yksirivinen ajattelu näkyy suoraan, monirivinen avautuu lainauslohkona. Salattua thinking-dataa, piilotettua
laajennussisältöä tai teknisiä payloadeja ei esitetä viesteinä. Tuntematon
sisältö saa hillityn esityksen ilman raaka-JSONia.

Työn asettuminen näkyy vasta vahvistetun Pi-havainnon perusteella;
`agent_end` ei yksin riitä, sillä sitä voi seurata automaattinen yritys.
Malli, käyttö ja pysähtymissyy liittyvät niitä tuottaneeseen
assistenttiviestiin, eivät koko työn keksittyyn yhteissummaan. Virhettä tai
exit-koodia ei päätellä raakatekstistä. Saapuva kysymys näkyy elävänä ja
avautuu nykyiseen vastausdialogiin. Ratkenneelle kysymykselle ei luvata
pysyvää historiakirjausta, ellei natiivi tallenne vahvista sitä; pelkkä
selaimen tapahtumaloki ei ole toinen keskusteluhistoria. Ehdolliset
esimerkit vedoksessa eivät ole toteutettuja host-faktoja.

Pi-kysymysten vastausdialogit on toteutettu, mutta niiden kuuluminen
sovittuun tuotelaajuuteen on edelleen
[avoin valinta](../issues/rethink-project-docs/item.md).

## Käyttöönotto

Yhteinen kehys näyttää tuotteen, palvelimen ja vaiheet GitHub → Repot → OpenAI.
Repolistan koko rivi toimii valintana. Aikarajaus on käyttäjän valittavissa,
ja valitut repot säilyvät löydettävissä. Kloonauksen eteneminen ja varmistettu
tulos erottuvat epäselvästä tuloksesta.

OpenAI-vaihe näyttää Pi:n kirjautumiskoodin, kopioinnin ja linkin
palveluntarjoajan sivulle. Koodin valmistuminen näkyy odotustilana.
Käyttöönoton keskeyttäminen on rauhallinen toissijainen toiminto, jonka
vahvistus kertoo uloskirjautumisen vaikutuksen.

## Toteutuksen lähteet

[Komponenttikartta](components.md) johtaa sovelluksen ja Storybookin yhteisiin
komponentteihin. [Arkkitehtuuri](../docs/architecture/events-and-recovery.md)
kuvaa sovelluksen ja visuaalisten komponenttien vastuut.
[Design-kierros](process.md) kertoo designerin ja toteuttajan työnjaon sekä
vedosten sovittamisen toteutukseen. [Testausohje](../TESTING.md) kuvaa
visuaalisen vertailun aineiston ja tarkistukset.
