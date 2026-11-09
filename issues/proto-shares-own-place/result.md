# Kierros 1: oma paikka jaetuille

Kierros: `design-system/prototypes/rounds/2026-11-08-jaetut/`
(`NOTES.md` kertoo tarinan, rakennuksen ja tarkistuksen). Akseli on se,
missä jaetut elävät ja miten rivi esittää itsensä.

- **Nyt**: tuotanto tänään. Osoitteet ovat Asetukset › Tili -sivulla uloskirjautumisen ja Git-identiteetin alla: otsikko, tila ja tekstipainikkeet.
- **1 Asetukset**: oma Jaetut-osio asetuksissa. Rivit ryhmissä Julkiset nyt, Vain sinä ja Päättyneet; pieni esikatselu ja kortin kuvakkeet aina näkyvissä.
- **2 Alkulehti**: etusivulla työtilojen alla Jaetut nyt -kortit isolla esikatselulla ja Kopioi linkki -painikkeella; yksityiset ja päättyneet yhden rivin takana.
- **3 Oma sivu**: Jaetut on oma sivu sivupalkissa Etusivun alla. Samat kortit kuin keskustelussa, keskusteluittain; kortti avaa esikatselun oikealle.

Kuvat: `evidence/r1-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`,
avattuna `r1-*-1-auki-*` (1: keston valikko, 2: muut osoitteet, 3:
kansio paneelissa) ja poistodialogi `r1-1-asetukset-3-poista-1440-light`.

## Mitä kaikki suunnat tekevät samoin

- Tili-sivulle jäävät vain profiili ja Git-identiteetti.
- Rivin nimi on kohteen otsikko. Sen alla ovat laji ja koko (tuotannon
  `viewFacts`/`offerFacts`), keskustelu linkkinä, työtila ja tieto
  arkistoinnista. Tila on sanoina: *Julkinen 7.12.2026 asti*, *Vain sinä*,
  *Julkisuus päättyi 6.11.* tai *Kohde on poistettu*.
- Toiminnot ovat tarjouskortin kuvakkeet (kierros 3, A Kulma) ja niiden
  perässä roskakori. Julkaisu kestää oletuspituuden, ja päivämäärä vaihtaa
  sen. Kopiointi on käytössä vain julkisessa kohteessa. Poistossa on
  tuotannon dialogi ja teksti.
- Aiemmin jaettuja ovat vanhentuneet osoitteet (maapallo julkaisee ne
  uudelleen samaan osoitteeseen) ja osoitteet, joiden kohteen agentti on
  poistanut. Jälkimmäisessä on vain roskakori.

## Host-tiedot

Kaikki tulee jo hostilta, eikä uutta rajapintaa tarvita:
`GET /api/v1/view-addresses` (otsikko, `view_id`/`offer_id`, tila,
`public_until`, `created_at`) liitetään selaimessa henkilön
näkymä- ja tarjouslistoihin (`/api/v1/views`, `/api/v1/file-offers`:
laji, tiedostot, koko, kansio, `conversation_id`) ja keskustelulistaan
(otsikko, työtila, arkistoitu). Kuvatarjouksen ja kansion kuvat ovat
hostin rajattuja pikkukuvia (`/thumbnail/<path>`), ja paneeli avaa
kohteen samoin kuin keskustelussa.

Puuttuvat tiedot, joita en keksinyt:

- **Näkymällä ei ole kuvaa.** Host ei ota näkymästä kuvaa, joten sen
  esikatselu on `</>`-merkki ja aloitustiedoston nimi. Suunnassa 3
  näkymän näkee paneelissa.
- **Poistettua osoitetta ei muisteta.** Host unohtaa sen kokonaan (ADR 0035),
  joten *aiemmin jaettuja* ovat vain vanhentuneet osoitteet ja osoitteet,
  joiden kohde on poistettu.
- **Yksityiseksi tehty ja koskaan julkaisematon ovat samaa tilaa**
  (`private`). Kumpikin näkyy muodossa *Vain sinä*.
- **Poistetun kohteen keskustelua ei tiedetä.** Rivillä on pelkkä otsikko.

## Decisions for later review

- **Samat kuvakkeet kuin kortissa, ei tekstipainikkeita** (vaihtoehto:
  nykyiset *Avaa / Kopioi linkki / Tee yksityiseksi / Poista*). Jari
  hyväksyi kortin kuvakkeet 8.11. Sama ohjain kahdessa paikassa opitaan kerran.
- **Roskakori on aina näkyvissä, ei ⋯-valikossa** (vaihtoehto: valikko).
  Poisto on tämän näkymän syy olla olemassa, koska varauskaton saa purettua
  vain sillä. Dialogi estää vahingot.
- **Vanhentunut kuuluu Päättyneisiin, ei Vain sinä -ryhmään.** Se on
  ollut julkinen, joten sen osoite voi olla muilla.
- **Suunnassa 3 mitään ei avata oletuksena.** Kapeassa sovelluskehyksessä
  avattu paneeli puristaa kortit; esikatselu avautuu painalluksesta.
- **Suunnan 3 sivupalkkirivi laskee julkiset** (*Jaetut 2*), ei kaikkia
  osoitteita. Julkinen on se, mikä on maailmalla.
- **Kansion esikatselu on 3–4 ensimmäistä kuvaa.** Se tarkoittaa yhtä
  pikkukuvapyyntöä kuvaa kohden, ja jokainen on rajattu.
- **Löydös:** tarjouskortin piilotetut kulmakuvakkeet vievät tilaa
  (`offer-card-corner-icons-in-flow`, kirjattu intakeen). Kierros ohittaa
  sen paikallisesti.
- Toteutus tarvitsee Explain-kortit molemmilla kielillä uudelle sivulle
  tai osiolle, roskakorille ja suodattimelle (suunta 3).

## Kysymykset Jarille

1. Mikä paikka: **1 Asetukset** (oma osio, tiivis lista), **2 Alkulehti**
   (julkiset isoina kortteina etusivun alaosassa) vai **3 Oma sivu**
   (Etusivun alla kuten *Agentin käytössä*, kortit keskusteluittain ja
   esikatselu paneelissa)?
2. Riittääkö näkymälle `</>`-merkki, vai haluatko oikean kuvan? Kuva
   vaatisi hostiin uuden kuvanoton, käytännössä otsattoman selaimen.
3. Riittääkö, että poistettu osoite katoaa listalta, vai pitäisikö
   poistoista jäädä jälki? Jälki olisi uusi tallennettava tieto.

**Suositus:** 3 Oma sivu. Jaettu on asia, jonka annat muille, ei
asetus. Oma sivu Etusivun alla löytyy samasta paikasta kuin *Agentin
käytössä*, kortti on sama kuin keskustelussa, ja paneeli antaa oikean
esikatselun myös näkymille ilman uutta hostin kuvanottoa. 1 on halvin ja
hyvä hallintaan, mutta jättää jaetut asetusten sekaan. 2 kilpailee
etusivun keskustelujen kanssa ja jää alas. Näkymän kuvaksi riittää
`</>`-merkki, eikä poistoista kannata pitää kirjaa.

## Jarin päätös (9.11.2026)

Suunta **3 Oma sivu** (Jaetut-sivu Etusivun alla, kortit keskusteluittain,
esikatselu paneelissa). Kysymyksiin 2–3 suosituksen mukaan: näkymälle
`</>`-merkki, poistoista ei jälkeä. Jari haluaa riffata sivun ulkoasua
seuraavilla kierroksilla ennen toteutusta.

# Kierros 2: Jaetut-sivun ulkoasu

Kierros: `design-system/prototypes/rounds/2026-11-09-jaetut-sivu/`
(`NOTES.md`). Paikka on päätetty (oma sivu Etusivun alla); akseli on se,
miltä sivu näyttää. Rivit ja host-tiedot ovat samat kuin kierroksella 1.

- **A Galleria**: isot esikatselukuvat ruudukossa, ryhmät Julkiset nyt, Vain sinä ja Päättyneet. Julkisen ruudun alla päättymispäivä ja Kopioi linkki.
- **B Lista**: tiivis lista uusin ensin, ja valittu jako isona oikealla osoitteen, päättymispäivän ja Kopioi linkki -painikkeen kanssa, kuten Agentin käytössä -sivu.
- **C Aikajana**: keskustelut aikajanalla viimeisimmän jaon mukaan ja niiden alla samat kortit kuin keskustelussa; kortti avaa esikatselun oikealle.

Kuvat: `evidence/r2-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`,
kansio avattuna `r2-*-1-auki-{1440,390}-light`, julkisen jaon keston
valikko `r2-*-2-kesto-1440-light`, kopioitu linkki
`r2-*-3-kopioi-390-light` ja tyhjä sivu `r2-*-4-tyhja-1440-light` ja
`-390-dark`.

## Mitä suunnat tekevät samoin

- Sivupalkissa *Jaetut 2* (julkisten määrä) Etusivun ja *Agentin
  käytössä* -rivin vieressä. Tyhjällä sivulla luku puuttuu.
- Julkinen jako näyttää päättymispäivän valikkona (sama kuin kortissa) ja
  kopioinnin. Kopiointi vie `/n/`-osoitteen leikepöydälle.
- Tyhjä sivu kertoo, mistä jako syntyy: kortin maapallosta keskustelussa.
- Poistettu kohde näkyy yliviivattuna, ja sillä on vain roskakori.

## Decisions for later review

- **A ja B lisäävät julkiselle jaolle tekstipainikkeen Kopioi linkki**
  kortin linkkikuvakkeen tilalle. Kopiointi on sivun yleisin toimi, kun
  jako on jo julkinen.
- **A:n ruudussa tila on lyhyesti *Julkinen*,** ja päivämäärä on
  sen vieressä valikkona. Pitkä *Julkinen 7.12.2026 asti* ei mahtunut
  ruutuun paneelin ollessa auki.
- **B näyttää uusimman jaon heti työpöydällä** (kierroksen 1 periaate *ei
  mitään auki oletuksena* koski paneelia). Puhelimessa lista tulee ensin,
  ja jako aukeaa omaksi näkymäkseen.
- **B:n suodattimessa on luvut vain työpöydällä.** Puhelimessa neljä
  lukua rivittivät suodattimen kahdelle riville, ja luvut ovat jo
  yläotsikossa.
- **C:n aikajanan päivä on keskustelun viimeisin jako,** ei keskustelun
  oma ajankohta. Host tietää jaon `created_at`:n, ja se on se, mitä
  muistetaan.
- Toteutus tarvitsee Explain-kortit molemmilla kielillä sivulle, sen
  rivin tai ruudun ohjaimille ja (B) suodattimelle.

## Kysymykset Jarille

1. Mikä ulkoasu: **A Galleria** (kuvat edellä, ryhmät tilan mukaan),
   **B Lista** (tiivis lista ja yksi jako isona, kuten Agentin käytössä)
   vai **C Aikajana** (keskusteluittain, samat kortit kuin keskustelussa)?
2. Riittääkö A:ssa ja B:ssä erillinen Kopioi linkki -painike, vai
   pidetäänkö vain kortin linkkikuvake kuten C:ssä?
3. Näytetäänkö B:ssä jaon koko osoite kentässä, vai riittääkö painike?
   Kentästä näkee, mikä osoite lähtee eteenpäin.

**Suositus:** B Lista. Jaetut-sivu on hallintasivu: siellä katsotaan,
mikä on maailmalla ja kuinka kauan, ja kopioidaan tai suljetaan linkki.
B näyttää sen yhdellä silmäyksellä, osoite ja päättymispäivä ovat isoina
eikä hoverin takana, ja rakenne on sama kuin viereisellä *Agentin
käytössä* -sivulla, joten sen oppii kerran. A on kaunein mutta
näkymien `</>`-ruudut ovat tyhjän näköisiä, kun oikeaa kuvaa ei ole. C on
lähinnä kierroksen 1 valintaa, mutta julkisuuden toiminnot jäävät
kortissa hoverin taakse.

## Jarin vastaus kierrokseen 2 (9.11.2026)

Pohjaksi **B Lista**, mutta listan pitäisi olla aikajanamainen (C:n
ajallinen jäsennys listan muodossa). Riffataan vielä yksi kierros siitä,
miltä aikajanamainen lista näyttää (kierros 3, avustaja `shares-page`).
Kysymykset Kopioi linkki -painikkeesta ja koko osoitteesta jäivät auki.

# Kierros 3: aikajanamainen lista

Kierros: `design-system/prototypes/rounds/2026-11-09-jaetut-aikalista/`
(`NOTES.md`). Pohja on kierroksen 2 B Lista: tiivis lista vasemmalla ja
valittu jako isona oikealla, osoite ja päättymispäivä näkyvissä ilman
hoveria. Akseli on se, miten lista jäsentyy ajassa. Mukana kulkee toinen
akseli, koska Jari jätti sen auki: miten valitun jaon osoite näytetään.

- **A Päivät**: lista päiväotsikoittain uusin ensin, rivillä keskustelu ja kellonaika. Valitussa jaossa koko osoite kentässä ja erillinen Kopioi linkki -painike.
- **B Keskustelut**: keskustelut pystyviivalla viimeisimmän jaon mukaan ja jaot niiden alla. Valitussa jaossa koko osoite kentässä ja linkkikuvake kentän päässä.
- **C Agenda**: päivämäärä omassa sarakkeessaan ja päivän keskustelut sen vieressä. Valitussa jaossa pelkkä Kopioi linkki -painike, osoitetta ei näytetä.

Kuvat: `evidence/r3-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`,
kansio valittuna `r3-*-1-auki-{1440,390}-light`, keston valikko
`r3-*-2-kesto-1440-light`, kopioitu linkki `r3-*-3-kopioi-{1440,390}-light`
ja tyhjä sivu `r3-*-4-tyhja-1440-light`.

## Mitä suunnat tekevät samoin

- Rivin tilarivillä lukee aina *Julkinen 7.12.2026 asti*, *Vain sinä*,
  *Julkisuus päättyi …* tai *Kohde poistettu*, joten julkiset erottuvat
  listasta ilman valintaa.
- Työpöydällä uusin jako näkyy oikealla heti, ja puhelimessa lista tulee
  ensin ja jako aukeaa omaksi näkymäkseen.
- Suodatin (Kaikki, Julkiset, Vain sinä, Päättyneet) karsii rivejä, ja
  aikajäsennys säilyy.
- Uutta host-tietoa ei tarvita: aika on osoitteen `created_at`, ja
  keskustelu tulee kohteen `conversation_id`:stä.

## Decisions for later review

- **Aikajärjestys on jaon luomisaika, ei kohteen tai keskustelun aika.**
  Host tietää vain jaon `created_at`:n. Uudelleenjulkaisu ei siirrä jakoa
  listan kärkeen, koska hostilla ei ole julkaisun aikaleimaa.
- **B:ssä keskustelun paikka on sen viimeisin jako,** joten saman
  keskustelun jaot pysyvät yhdessä, vaikka ne olisi tehty eri päivinä.
  Siksi rivi näyttää viikonpäivän vain, kun se poikkeaa otsikon päivästä.
- **C ryhmittelee päivän sisällä keskustelun mukaan.** Saman keskustelun
  eri päivien jaot ovat eri päivien alla (Raportti /var/tmp:stä näkyy
  6.11. ja 31.10.).
- **Puhelimessa osoite tulee ennen kuvakkeita.** Päivämäärän
  työkaluvihje jäi kosketusnäytöllä päälle ja peitti alla olevan
  kopiointipainikkeen. Nyt vihje osuu ohjetekstin päälle.
- Toteutus tarvitsee Explain-kortit molemmilla kielillä sivulle, rivin
  tilariville, suodattimelle ja osoitekentälle tai Kopioi linkki -painikkeelle.

## Kysymykset Jarille

1. Mikä jäsennys: **A Päivät** (päiväotsikot, keskustelu rivillä),
   **B Keskustelut** (keskustelut aikajanalla, jaot niiden alla) vai
   **C Agenda** (päivä sarakkeessa, päivän keskustelut vieressä)?
2. Kopiointi: **erillinen Kopioi linkki -painike** (A, C) vai
   **linkkikuvake kentän päässä** (B)?
3. Osoite: näytetäänkö **koko osoite kentässä** (A, B) vai riittääkö
   **pelkkä painike** (C)?

**Suositus:** A Päivät, kenttä ja erillinen painike. Päiväotsikot ovat
tutuin aikajana (kuten viestit tai tiedostohistoria), ja ne vievät
listassa vähiten tilaa, joten rivit pysyvät B:n tiiviinä. Keskustelu
näkyy rivillä, joten B:n ryhmittely ei ole tarpeen sen löytämiseksi.
B:n sidos keskusteluun on vahvempi, mutta saman keskustelun eri päivien
jaot rikkovat sen aikajärjestyksen. C:n sarake vie listasta leveyttä
eikä anna päiväotsikkoa enempää. Koko osoite kannattaa näyttää, koska
siitä näkee, mitä on antamassa eteenpäin. Erillinen painike on
kosketusnäytöllä isompi kohde kuin kentän päässä oleva kuvake, ja
kopiointi on tämän sivun yleisin toimi.

## Jarin vastaus kierrokseen 3 (9.11.2026)

**B Keskustelut.** Rivillä pitää näkyä keskustelu, johon jako liittyy: sen
kautta käyttäjä tunnistaa jaon. Keskustelun päivämäärä voi olla sen alku-
tai loppupäivä, kumpi on mielekkäämpi; kapellimestari valitsi
loppupäivän (keskustelun viimeisin toiminta), jotta järjestys vastaa
sivupalkin *Viimeisimmät*-listaa eikä yhä jatkuva vanha keskustelu
hautaudu. Painike vai kuvake ja koko osoite jäivät kommentoimatta.

# Kierros 4: B Keskustelut viimeisteltynä (toteutuksen määrittely)

Kierros: `design-system/prototypes/rounds/2026-11-09-jaetut-keskustelut/`
(`NOTES.md`). Kierroksen 3 B on mukana vain vertailukohtana.

- **Kierros 3 B**: vertailukohta. Keskustelut viimeisimmän jaon mukaan, päivä keskustelun nimen edessä.
- **4 Viimeistely**: keskustelut viimeisimmän toiminnan mukaan kuten sivupalkissa, uusin ensin. Keskustelun nimi johtaa, päivä oikealla, jaot alla; osoite kentässä ja linkkikuvake sen päässä.

Kuvat: `evidence/r4-viimeistely-0-oletus-{1440,390}-{light,dark}.avif`,
vertailu `r4-kierros3-b-0-oletus-1440-light`, kansio valittuna
`r4-viimeistely-1-auki-1440-light` ja `-390-dark`, keston valikko
`-2-kesto-{1440,390}-light`, kopioitu linkki `-3-kopioi-1440-dark` ja
`-390-light`, tyhjä sivu `-4-tyhja-1440-light` ja `-390-dark`.

## Määrittely

- **Sivu**: oma sivu *Jaetut* sivupalkissa Etusivun alla, rivillä
  julkisten määrä (*Jaetut 2*; ei lukua, kun mitään ei ole julkisena).
  Otsikon alla yhteenveto (*2 julkista, 5 vain sinulle, 3 päättynyttä tai
  poistettua*) ja suodatin Kaikki / Julkiset / Vain sinä / Päättyneet
  (luvut vain työpöydällä).
- **Lista**: keskustelut pystyviivalla, uusin viimeisin toiminta ensin.
  Keskustelun otsikkorivillä nimi linkkinä keskusteluun ja oikealla
  viimeisimmän toiminnan päivä (*ma 9.11.*, vihjeenä päivä ja kellonaika);
  alla työtila, *arkistoitu* ja jakojen määrä. Pisteen väri kertoo, onko
  keskustelussa jotain julkisena. Jaot keskustelun alla uusin ensin:
  pikkukuva tai merkki, otsikko, *jaettu la 7.11. klo 18.41 · Näkymä* ja
  tilarivi (*Julkinen 7.12.2026 asti*, *Vain sinä*, *Julkisuus päättyi …*,
  *Kohde poistettu*).
- **Valittu jako**: työpöydällä oikealla, oletuksena ensimmäisen
  keskustelun uusin jako. Yläpuolella *Keskustelusta <nimi>* linkkinä,
  sitten otsikko, laji, koko ja jakopäivä. Tilalaatikossa tila sanoin ja
  kortin kuvakkeet (maapallo, päättymispäivän valikko, oma välilehti,
  roskakori), julkisella jaolla koko osoite kentässä ja linkkikuvake
  kentän päässä, ja lyhyt ohje. Alla kohde itse kuten paneelissa.
- **Puhelin**: lista ensin, jako omaksi näkymäkseen ja takaisin
  *Jaetut*-painikkeella. Osoite ennen kuvakkeita, linkkikuvake 44 px.
- **Tyhjä sivu**: *Et ole jakanut vielä mitään* ja se, mistä jako syntyy
  (kortin maapallo keskustelussa).
- **Host-tiedot**: kaikki on jo olemassa. Osoitteet
  (`GET /api/v1/view-addresses`) liitetään selaimessa näkymiin ja
  tarjouksiin (`conversation_id`) ja snapshotin keskusteluihin (otsikko,
  työtila, `archive`, `changed_at`). Keskustelun viimeisin toiminta on
  `changed_at`, Pi-istuntotiedoston muokkausaika, jolla sivupalkki jo
  järjestää hiljaiset keskustelut; snapshot kertoo sen myös
  arkistoiduista.

## Decisions for later review

- **Koko osoite näkyy kentässä, ja kopiointi on linkkikuvake kentän
  päässä** (vaihtoehdot: erillinen *Kopioi linkki* -painike, tai pelkkä
  painike ilman osoitetta; kierros 3 A ja C). Jari ei kommentoinut, joten
  kierroksen 3 B:n ratkaisu jäi. Kentästä näkee, mitä antaa eteenpäin, ja
  kenttä ja kuvake ovat yksi ohjain. Puhelimessa kuvake on 44 px leveä,
  joten erilliselle painikkeelle ei ollut syytä.
- **Puhelimessa osoite tulee ennen kuvakkeita** (kierroksen 3 löydös).
  Kosketusnäytöllä päivämäärävalikon työkaluvihje jää näkyviin
  napautuksen jälkeen ja peitti alla olevan kopiointipainikkeen. Nyt se
  osuu ohjetekstin päälle. Tuotannon `QuickTooltip`-käytös kosketuksella on
  itsessään kyseenalainen; tämä järjestys kiertää sen tällä sivulla.
- **Keskustelun päivä on viimeisin toiminta (`changed_at`), ei
  viimeisin jako** (Jari: alku- tai loppupäivä, kumpi mielekkäämpi;
  kapellimestari valitsi loppupäivän). Jatkuva keskustelu pysyy kärjessä
  kuten sivupalkissa, vaikka jaot olisivat vanhoja.
- **Keskustelu, jolla ei ole istuntotiedostoa (`changed_at` puuttuu), saa
  päiväkseen uusimman jakonsa ajan.** Muuten sen paikka olisi
  arvaus.
- **Osoite, jonka kohde on poistettu, on viimeisenä omana ryhmänään
  *Kohde poistettu***, ja sen päivä on jaon päivä. Kohde ei kerro enää
  keskusteluaan.
- **Jaon oma aika näkyy rivillä (*jaettu …*),** koska keskustelun päivä
  ei enää kerro, milloin jako tehtiin.
- Toteutus tarvitsee Explain-kortit molemmilla kielillä sivulle,
  keskustelun otsikkoriville (päivän merkitys), tilariville,
  suodattimelle ja osoitekentälle ja sen linkkikuvakkeelle.
- Toteutus kannattaa tuoda kokeellisena ominaisuutena
  (`AGENTS-WORKFLOW.md`), koska se siirtää osoitteet pois Tili-sivulta.

## Kysymykset Jarille

Ei avoimia kysymyksiä. Kierros on määrittely: seuraava askel on toteutus,
ellei Jari halua muuttaa jotain kuvista.

## Jarin päätös kierrokseen 4 (9.11.2026)

Viimeistely hyväksytty: toteutetaan kierroksen 4 määrittelyn mukaan
(`shares-page-implement`).
