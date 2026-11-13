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

Värillistä reunaraitaa ei käytetä korostukseen, valintaan eikä tilaan: ei
levennettyä `border-left`iä eikä `inset`-varjoa pinnan sivussa. Raita on
tunnistettava maneeri, "vähän niin kuin emdash", eikä se kerro mitään, mitä
kuvake, teksti tai pinta ei jo kerro (Jari 22.10. ja 29.10.2026). Tila näkyy
merkistä ja tekstistä; jos pinta tarvitsee lisäksi korostusta, se saa pehmeän
taustan ja koko reunan ympäri 1 px:n tilan viivan (`--ah-*-line`).
Epäonnistunut työkalurivi on reunoiltaan samanlainen kuin onnistunut.
Neutraalit 1 px:n jakoviivat paneelien välissä, lainauksen harmaa viiva ja
vuoron aikajana eivät ole korostusraitoja.
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
vihjeteksti (Jari 12.10.2026). Täällä suositaan aina symboleita: kun
valitaan sanan ja kuvakkeen välillä, kuvake voittaa, ja vihjeteksti kertoo
tarkemmin, mitä painike tekee, esimerkiksi henkilörivin palautuskuvakkeen
*Palauta oletukseen (20 GiB)* (Jari 7.11.2026).

Järjestelmäteema on oletus; käyttäjä voi valita myös vaalean tai tumman teeman.
Fokus näkyy molemmissa teemoissa. Vähennetyn liikkeen asetus poistaa pulssit ja
siirtymät, joten liike täydentää tekstillä tai merkillä kerrottua tietoa.
Pitkä teksti ja zoomaus saavat kasvattaa sisältöä peittämättä toimintoja.

## Painikkeet

Kaikki painikkeet, segmentit ja pillerit ovat yksi primitiivi
(`ControlButton` ja `Segmented` tiedostossa
`web/src/components/ControlElements.tsx`), ja koon ratkaisee rooli eikä
näkymä (Rooli ratkaisee, Jari 17.10.2026).
Mitat ovat tokeneina tiedostossa `tokens/spacing.css`
(`--ah-control-page|row|inline` sekä fontti, sivutäyte, ikoni ja väli).

| Rooli | Mihin | Työpöytä | Puhelin | Teksti | Ikoni |
| --- | --- | --- | --- | --- | --- |
| `page` | näkymän päätoiminto: käyttöönotto, vahvistus, lähetys | 44 | 44 | 14,5 | 18 |
| `row` | kortin tai listarivin toiminto, yläpalkin ikonit | 32 | 40 | 13 (14) | 16 |
| `inline` | pillerit, segmentit, kentän tai palkin sisäiset kontrollit | 26 | 32 | 12 | 14 |

Ikonipainike on neliö, jonka sivu on roolin korkeus. Hierarkia on yhteinen:
ensisijainen täytetty, toissijainen ja hiljainen tekstipainike sävytetyllä
pinnalla, vaarallinen punainen ja pehmeä vaarallinen. Ikoni on tekstin
vasemmalla tekstin keskilinjalla roolin kiinteällä välillä. Kulma on 8 px;
pillerit ovat täysin pyöreitä. Segmentit ovat kosketuksissa toisiinsa
upotetulla uralla, ja valittu segmentti nousee pinnaksi. Näkymä ei aseta
painikkeelle korkeutta, sivutäytettä tai fonttikokoa; se valitsee roolin.
Natiivit avattavat (`<details>`, kuten Valmiit ja Arkisto) saavat sivupalkin
nuolen selaimen kolmion sijaan.

**Fokusrengas** on 2 px ja 1 px kontrollin ulkopuolella
(`--ah-focus-width`, `--ah-focus-offset`), jolloin se vie
`--ah-focus-room` (3 px) tilaa. Kolme sääntöä pitävät sen ehjänä:
vierekkäiset erilliset kontrollit ovat vähintään `--ah-control-gap` (6 px)
päässä toisistaan, jolloin renkaat eivät koskaan peitä toisiaan; toisiinsa
kiinni olevat segmentit piirtävät renkaan sisäpuolelleen
(`--ah-focus-inset`); ja vierivä säiliö jättää reunaansa vähintään
`--ah-focus-room`-verran tilaa, kun taas näppäimistöfokuksen vierittämä
kontrolli pysähtyy saman verran reunan sisäpuolelle (`scroll-margin`).

## Tilat ja toimintojen palaute

Agentin aktiivisuus, uuden vastauksen tai virheen vaatima huomio,
kirjoitusoikeus ja operaation tulos esitetään erikseen, koska ne voivat olla
voimassa samanaikaisesti. Merkki, sana ja väri tekevät tilasta tunnistettavan
myös ilman liikettä tai värien erottamista.

Odottaa tarkoittaa avointa agenttia, joka odottaa käyttäjän vastausta; sen
merkki on ontto rengas. Odottaa taustatyötä tarkoittaa, että agentti odottaa
omaa taustaprosessiaan tai workeriaan eikä käyttäjältä tarvita mitään; sen
merkki on liikkumaton aksenttirengas, jonka keskellä on piste, ja yläpalkki
kertoo vain tilan, odotettavat nimet ovat vihjeessä ja taustatyön paneelissa.
Keskustelussa käynti poistaa huomiomerkinnän mutta
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

Yhteinen varoitus (`WarningBanner`, Jari 28.10.2026, kierros
`prototypes/rounds/2026-10-28-github-yhteys-2`, suunta Näkyvä yritys kentän
päällä) kertoo, mitä palvelin tekee viasta tai mitä käyttäjä voi tehdä.
Sävyjä on neljä: palvelimen oma yritys (yksi hiljainen rivi pyörivällä
merkillä, ei toimintoa), neutraali, vakava ja hetken näkyvä paluu. Sävy
näkyy pehmeänä pintana, ohuena reunana ja kuvakkeen pyöreänä merkkinä;
sivureunan korostusraitaa ei käytetä. Siinä on enintään yksi
korjaustoiminto, joka puhelimessa vie koko rivin tekstin alla, ja
puhelimessa teksti voi olla lyhyempi. Keskustelussa varoitus on
kirjoituskentän yllä kentän levyisenä, muissa näkymissä yläreunan nauhana.
Varoitusta ei voi sulkea: se tulee vasta, kun palvelin ei korjaa asiaa
itse, ja poistuu itsestään, kun tila korjaantuu.

## Sovelluskehys

Sivupalkin Etusivu ja sen yllä palvelimen nimi vievät työtilojen etusivulle ([nykyinen navigaatiovedos](drafts/Navigaatio%20ja%20asetukset.dc.html),
Jari 14.10.2026, kierros `prototypes/rounds/2026-10-14-katsaukset`, suunta
Työtilaosiot). Työtila on osion otsikko: nimi, Git-haara ja muuttuneiden
tiedostojen määrä, valmiiden lukumäärä, uusi keskustelu ja `…`-valikko
työtilan hallintaan. Sen alla avoimet keskustelut ovat kahden palstan
kortteina huomiojärjestyksessä, ja kussakin on keskustelun tilannekatsaus
kokonaan ja sanatarkasti Seuraavaksi-riveineen. Juuri valmistunut
keskustelu, jolla ei vielä ole katsausta, näkyy pelkällä nimellä. Työtilat,
joissa ei ole avointa työtä, ovat tiiviinä rivilistana alimpana. Uusi työtila
luodaan kloonaamalla GitHubista tai uutena hakemistona. Nähty virhe säilyy
keskustelurivillä ilman että se jää etusivun kärkeen.

Työtilat ryhmittelevät keskustelut. Työtilan sisällä ensin ovat uudet,
uuden vastauksen saaneet, työskentelevät ja odottavat keskustelut; valmiit
taittuvat yhden "Valmiit"-rivin taakse. Keskustelu on yksi rivi: otsikko ja
tilamerkki oikealla (Jari 13.10.2026). Työtilan nimi avaa sen oman sivun;
erillinen nuoli avaa ja sulkee sivupalkin ryhmän. Työtilasivulla näkyvät nimi,
polku, uuden keskustelun aloitus ja keskustelut. Sivupalkin voi kaventaa
kaistaksi, jossa keskeiset toiminnot säilyvät saatavilla. Puhelimessa sama
navigaatiosisältö avautuu valikkolaatikkoon keskustelun päälle.

Tilipainike on kiinteästi sivupalkin alareunassa, ja vain työtilojen lista
vierii sen yläpuolella. Painikkeessa näkyvät etunimi ja profiilikuva tai sen
varaesitys. Se avaa ylöspäin valikon: koko nimi ja sähköposti, Asetukset,
Palvelimen ylläpito vain ylläpitäjälle, teeman valinta (Järjestelmä, Vaalea,
Tumma) ja Kirjaudu ulos. Palvelimen ylläpidolla ei ole muuta linkkiä
sivupalkissa. Työtilat-otsikon vieressä on Uusi työtila, ja työtilarivin
`…`-valikossa ovat Uusi keskustelu, Avaa työtilasivu, Kopioi polku, Avaa
GitHubissa ja Poista työtila, joka on estetty, kunnes palautettava poisto on
toteutettu. Valikko pysyy auki, vaikka keskustelu vierii (Jari 14.10.2026,
kierros `prototypes/rounds/2026-10-14-palkki`, suunta Tilivalikko alhaalla;
kirjastossa `lib/account.*`). Asetusten osiot ovat Tili,
Yhteydet tällä palvelimella, Ulkoasu ja Istunto.

Palvelimen ylläpidon osiot noudattavat yhtä normia (Jari 7.11.2026, kierros
`prototypes/rounds/2026-11-07-palvelinosioiden-normi`, suunta C Yhdistelmä):
johdanto kortin yllä, kortti nimi–selite–arvo-riveistä, mittari luvut
otsikon vieressä, paksu palkki ja selite, luvut stepperillä sekä väliotsikon
alla oma kortti henkilö- tai palvelulistalle, jossa on sarakeotsikot ja
jokaisen rivin lukema omassa sarakkeessaan. Uusi palvelinosio kootaan
`ServerSection`-osista. Käyttöönoton reittieditori on oma työkalunsa.

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

Puhelimen yläpalkki on yksi noin 56 px korkea kokonaisuus (Jari 6.11.2026,
Alarivi ja A Valikko). Tilapiste on otsikon edessä. Otsikon alla on yksi
hiljainen painike: työtila · Gitin lähtevät ja muuttuneet · kontekstirengas ·
malli. Ennen ensimmäistä viestiä malli on vain kirjoituskentässä. Alarivin
napautus avaa sen alle valikon, jonka otsakkeena on tila ja jonka riveillä
ovat työtilan, Gitin, kontekstin ja mallin täydet arvot. Rivi avaa kyseisen
tiedon nykyisen näkymän; erillisiä ”Näytä tiedot” -ohjeita ei ole. Napautus
alariviin uudestaan, valikon ulkopuolelle tai Esc sulkee valikon. Paneelit ja
kertatoiminnot ovat ⋯-valikossa. Työpöydän sommittelu ei muutu.

Agentin työ on oletuksena piilossa (Jari 15.10.2026, kierros
`prototypes/rounds/2026-10-15-hiljainen`). Pi:n vuoron säie pysyy kiinni:
työn ajan näkyy yksi inforivi "Agentti työskentelee", nykyinen vaihe ja
kello, ja vastaus tulee sen alle. Inforivin alussa on painike "Näytä työ"
(kierros `2026-10-15-inforivi-2`, suunta Rivin alussa). Valmis säie näkyy
yhteenvetorivinä ja aukeaa painamalla; itse suljettu pysyy kiinni.
Tilivalikon "Agentin työ: Piilossa / Näkyvissä" vaihtaa oletuksen. Avatussa
tai käynnissä olevassa säikeessä striimautuva blokki on auki ja sulkeutuu
valmistuttuaan (kierros `2026-10-15-saikeet`). Näkymä seuraa uusinta
sisältöä, kunnes lukija itse vierittää ylös; blokkien sulkeutuminen ei
katkaise seurantaa. Näkymää lyhyempi keskustelu täyttyy alhaalta: säie on
kirjoituskentän päällä ja kasvaa ylöspäin, ja tyhjän keskustelun teksti on
alhaalla kentän vieressä (Jari 16.10.2026, kierros
`2026-10-16-tayttosuunta`, suunta Alhaalta). Säikeen yläreuna saa vapaan
tilan automaattisella marginaalilla eikä `justify-content: flex-end`
-säännöllä, jotta näkymää pidemmän säikeen voi yhä vierittää ensimmäiselle
riville. Tiheys on Tiivis (`prototypes/lib/density.css`, kierros
`2026-10-14-tiheys`). Näytä työ -painike pysyy osoittimen alla: työ
ilmestyy sen yläpuolelle ja vaiheet tulevat näkyviin porrastetusti (kierros
`2026-10-15-nayta-tyo`, suunta Porrastettu). Inforiviä ei piirretä uudelleen
kellon tikittäessä, koska uudelleenpiirto hukkaa painalluksia ja välkyttää
korostusta; vain kello ja vaihe päivittyvät.

Agentin taustatyö on kentän yllä kahtena pienenä merkkinä, spinoffit ja
prosessit (Jari 16.10.2026, kierros `prototypes/rounds/2026-10-16-taustatyo-riff`,
suunta Merkit; kirjastoversio `prototypes/lib/strip.*`). Levossa merkki kertoo
vain kuvakkeella ja luvulla, onko lajia käynnissä; kello merkin kulmassa
kertoo, että agentin päättynyt vuoro odottaa sitä, ja punainen piste, että
spinoff päättyi mergeämättä ja sen haara on yhä olemassa. Piste pysyy, kunnes
haara on poistettu tai mergetty; katsominen ei sitä poista. Kello on palkin
ainoa odotusmerkki, koska yläpalkki sanoo jo *Odottaa taustatyötä*, ja
odotusmerkki sykkii vain sivupalkissa: haaramerkistä sykkii vain haara ja sen
pää, runko pysyy (Jari 17.10.2026). Työskentelevän keskustelun merkki on
sykkivä aksenttipiste kuten [vedoksessa](drafts/Kontrollitilat%20ja%20agentin%20tila.dc.html).
Säikeessä ei ole erillistä spinoff-ryhmää; spinoffit näkyvät vain merkissä. Merkki avaa kelluvan paneelin, jossa
lajit ovat välilehtinä ja päättyneet on taitettu; taite aukeaa itsestään, kun
siellä on punainen piste. Prosessirivillä on nimi ja sen perässä lyhyt,
katkaistu pala komentoa; rivi avaa prosessin omaan ikkunaansa (tuloste,
seuraa tai pysäytä seuraaminen, pysäytä, pakota lopetus, poista päättyneet).
Spinoffirivi avaa spinoffin vain luku -näkymän. `taskfleet run wait` näkyy
spinoffinsa kellona eikä koskaan prosessina, ja *Poista päättyneet* poistaa
vain prosesseja. Selaimen sulkemisesta ei luvata mitään.

Tilannekatsaus on oma korttinsa suoraan kirjoituskentän yllä: otsakkeessa
aika keskustelun viimeisestä viestistä (ei katsauksen luomisesta, Jari
27.10.2026), oikealla päivitys ja sulkeminen. Suljettu katsaus pysyy kiinni, kunnes
syntyy uudempi (Jari 13.10.2026). Kortti ei kerro, miten katsaus syntyi, eikä
näytä vanhentunutta katsausta: kun katsauksen jälkeen tulee uusia viestejä,
automaattinen katsaus poistuu näkyvistä, kunnes uusi syntyy keskustelun
oltua taas toimettomana. Itse pyydetystä katsauksesta jää tilalle pelkkä
pyyntö luoda uusi (Jari 25.10.2026).

Levossa kirjoituskenttä on yksirivinen ja Lähetä-ikoni on sen vieressä;
kenttä kasvaa tekstin mukana noin kahteentoista riviin ja vierittyy sitten.
Pi:n työn ajan kentän alle tulee rivi, jossa vasemmalla on Stop ja oikealla
valinta Ohjaa / Työn jälkeen; Lähetä tekee valitun. Stop pysäyttää heti ilman
vahvistusta, koska agentin saa jatkamaan pyytämällä. Valinnan vihjeteksti
kertoo ohjaamisen ja työn jälkeen lähtevän viestin eron; pikanäppäinten
ohjeriviä kentän alla ei ole (Jari 13.10.2026). Jonot ovat tiiviitä rivejä, joilla on yhteinen otsake ja koko
jonon tyhjennys. Hylätty lähetys jättää tekstin korjattavaksi; epävarman
lähetyksen yhteydessä tekstin voi ottaa talteen.

Kenttä on käytössä myös silloin, kun Pi ei ole käynnissä: uutta keskustelua
luotaessa ja pysähtyneessä keskustelussa (Jari 16.10.2026, kierros
`prototypes/rounds/2026-10-16-jonolahetys`, suunta Kupla odottaa). Ennen kuin
Pi ottaa viestin, se näkyy keskustelussa heti katkoviivaisena, hillittynä
kuplana, jonka otsakkeessa lukee "Odottaa Pi:tä". Ennen Pi:n käynnistymistä
lähetetyt viestit Pi saa yhtenä viestinä. Yläpalkissa ei ole tilaa eikä
missään kerrota Pi:n käynnistymisestä; kupla riittää. Kentän alla on Stop,
joka palauttaa odottavat viestit kenttään järjestyksessä ennen luonnosta.
Epäonnistunut käynnistys näyttää viestin punaisena kuplana "Ei lähtenyt" ja
rivin "Pi ei käynnistynyt. Viesti on tallessa." toimintoineen Yritä uudelleen
ja Muokkaa. Pysähtynyt selainkeskustelu avautuu luettavana historiana ilman
Vain luku -tilaa ja Jatka keskustelua -painiketta; Pi käynnistyy vasta, kun
viesti lähetetään. Uusi työtila saa yhden keskustelun, ja fokus siirtyy sen
kenttään.

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
Työkalurivin otsakkeessa työkalun nimi näkyy aina kokonaan, ja komento tai kohde pysyy yhdellä rivillä ja päättyy tarvittaessa "…"-merkkiin; koko komento näkyy avatussa kortissa (Jari 13.10.2026). Sivupalkin ylimpänä on tulosteen kopiointi, myös lyhyellä tulosteella. Sama
laatikko näyttää myös vastauksen koodin. Kieli ja rivimäärä ovat himmeänä
laatikon sisällä oikeassa yläkulmassa ja väistyvät, kun osoitin tai fokus on
laatikossa; omaa riviä laatikon alla ei ole (Jari 15.10.2026, kierros
`prototypes/rounds/2026-10-15-koodiotsake`, Kulmassa).
Laatikon sivupalkki on ryhmitelty: kopiointi · näkymä (alku ja loppu,
vieritettävä ikkuna, kaikki rivit) yhtenä valitsimena · Alkuun ja Loppuun
vain vieritettävässä ikkunassa · rivitys ja oma ikkuna. Näkymä on ainoa
painettuna näkyvä tila; Alkuun ja Loppuun ovat tekoja, jotka estyvät, kun
laatikko on jo siinä päässä, joten mikään ei jää korostetuksi vierityksen
jälkeen. Pitkiä rivejä ei rivitetä oletuksena: reunan varjo kertoo rivin
jatkuvan, ja rivitys sisentää jatkorivin (Jari 13.10.2026). Kun
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
työkalujen ryhmittely on myöhempää työtä. Tiedostotyökalujen suljettu rivi
kertoo määrän (read "34 riviä", write "uusi · 34 riviä", edit "+5 −2"); read
ja write avautuvat tulostelaatikkoon tiedoston kielellä, ja edit näyttää
rividiffin: poistetut rivit punaisella ja lisätyt vihreällä pohjalla, ja
muuttuneen rivin sisällä erilaiset sanat voimakkaammalla sävyllä kuten VS
Codessa. Bash-komennon oikealla puolella on oma kopiointipainike tulosteen
sivupalkin linjassa (Jari 13.10.2026). Pitkä käyttäjän viesti supistuu kahdeksaan
riviin, mutta sen saa auki kokonaan.

Malli ja ajattelutaso ovat yläpalkissa yhtenä merkkinä (esim. "gpt-5.5 · high"),
joka avaa tiedot; tiedoissa on mallin koko tunniste kopioitavana ja
ajattelutaso. Keskustelussa ei näytetä Pi:n alkutilan asetusmerkintöjä, koska malli ja
ajattelutaso ovat jo yläpalkissa. Vain todellinen mallin tai ajattelutason
muutos näkyy hillittynä rivinä vanhasta uuteen; nykyisen arvon toistava
asetusmerkintä on hiljainen. Mallit näytetään nimillä, ei provider/model-
tunnisteilla (Jari 23.10.2026). Tiivistys kuuluu samaan hillittyyn riviperheeseen. Mallisirun vasemmalla puolella on kontekstin rengas ja prosentti (Jari 26.10.2026, kierros `prototypes/rounds/2026-10-25-kontekstin-mittari`, suunta Rengas): huomioväri 70 %:sta ja virheväri 90 %:sta kuten Pi:n alarivillä, merkki renkaassa Pi:n tiivistysrajan kohdalla, tiivistyksen aikana pyörivä kaari ja sen jälkeen "?" Pi:n seuraavaan vastaukseen asti. Ennen ensimmäistä vastausta rengasta ei ole, ja tuntemattoman ikkunan malli näyttää tokenit ilman osuutta. Puhelimessa prosentti näkyy vasta 70 %:sta. Rengas avaa tiedot. Pi:n
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

Pi-kysymyksiin vastataan ja ne perutaan dialogissa keskustelun sisällä.

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

Sovelluksen ja Storybookin yhteiset komponentit ovat
`web/src/components/`-hakemistossa, ja `web/AGENTS.md` kertoo sovelluksen ja
visuaalisten komponenttien vastuut. [Design-kierros](process.md) kertoo designerin ja toteuttajan työnjaon sekä
vedosten sovittamisen toteutukseen. [Testausohje](../TESTING.md) kuvaa
visuaalisen vertailun aineiston ja tarkistukset.
