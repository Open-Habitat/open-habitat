# Käyttöliittymän design

Omega Habitatissa käyttäjä lukee agenttikeskustelua ja seuraa sen työtä.
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

Työtilat ryhmittelevät keskustelut. Työtilan nimi avaa sen oman sivun;
erillinen nuoli avaa ja sulkee sivupalkin ryhmän. Työtilasivulla näkyvät nimi,
polku, uuden keskustelun aloitus ja keskustelut. Sivupalkin voi kaventaa
kaistaksi, jossa keskeiset toiminnot säilyvät saatavilla. Puhelimessa sama
navigaatiosisältö avautuu valikkolaatikkoon keskustelun päälle.

Tilipainikkeessa näkyvät etunimi ja profiilikuva tai sen varaesitys.
Avattu tilinäkymä näyttää sähköpostin. Asetusten osiot ovat Tili,
Yhteydet tällä palvelimella, Ulkoasu ja Istunto.

## Keskustelu

Keskustelun yläpalkissa ovat otsikko, olennainen tila ja Tiedot-valikko,
josta tekniset tiedot avautuvat. Viestit, työkalurivit ja kirjoituskenttä
noudattavat yhteistä palstaa. Viimeisimpään-painike pysyy näkyvänä myös
kirjoituskentän kasvaessa. Taustapäivitys säilyttää lukukohdan ja fokuksen
sekä jättää luettavan sisällön näkyviin.

Työn aikaiset Keskeytä, Ohjaa ja Lähetä erottuvat tehtävänsä mukaan.
Kentän yhteydessä kerrotaan ohjaamisen ja työn jälkeen jonosta lähetettävän
viestin ero. Jonot ovat tiiviitä rivejä, joilla on yhteinen otsake ja koko
jonon tyhjennys. Hylätty lähetys jättää tekstin korjattavaksi; epävarman
lähetyksen yhteydessä tekstin voi ottaa talteen.

Keskustelulohkojen esitys tekee käyttäjälle tarkoitetun sisällön luettavaksi
samalla tavalla historiassa ja reaaliajassa. Salattua thinking-dataa tai
teknisiä payloadeja ei esitetä viesteinä. Tuntematon sisältö saa hillityn
esityksen.

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
