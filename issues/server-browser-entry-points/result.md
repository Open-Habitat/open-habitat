# Palvelinselaimen paikka: sivupalkki, siru vai molemmat

## Kierros 3: selain kolmessa paikassa (22.11.2026)

### Saatesanat

Keskustelussa näkyvä osa on nyt pieni. Selaimen pyyntö ja agentin
selaintyö näkyvät kolmessa paikassa samaan aikaan, ja jokainen niistä
kertoo tilan omalla tavallaan:

- **Sivupalkin Oma selain** on nyt tavallinen rivi kuten Tuotokset.
  Kortti on poistettu, ja sillä on oma ikkunakuvake. Tuotokset pitää
  maapallonsa. Rivin lopussa on lyhyt tila: *1 ikkuna*, *agentti ·
  2 ikkunaa*, *odottaa sinua* (vihreä pilleri) tai *sinä ohjaat*.
- **Keskustelun rivissä** on selainmerkki ajan tilalla. Kun keskustelu
  odottaa sinua selaimessa, merkki on rajattu ikkunakuvake ja sana
  *selain*, joten rivin erottaa tavallisesta Sinun vuorosi -rivistä, jossa
  on vain aika. Kun agentti työskentelee selaimessa, rivillä on hiljainen
  ikkunakuvake. Valmiista keskustelusta merkki poistuu.
- **Keskustelussa** suunnat eroavat koon ja muodon mukaan. Kaikki päättyvät
  hyväksymääsi Selain-korttiin, joten osat ovat samaa perhettä.

Suosittelen **suuntaa 2, Kortti**. Sama Selain-kortti on keskustelussa koko
ajan ja vaihtaa tilaa paikallaan. Työn aikana se on *Selain nyt*. Kun agentti
pyytää, kortin reuna korostuu ja pyyntö sekä **Ota ohjaus ja hoida** ovat
otsikkorivillä. Kun ohjaat, kortissa on **Anna takaisin**. Lopuksi siitä
tulee käynnin merkintä. Työpöydällä kortti on 38–56 px korkea, saman kokoinen
kuin Muutokset, ja uutta palikkaa ei tarvita. **Rivi** (28 px) on
pienin, mutta live-rivi ja lopun kortti ovat kaksi eri muotoa. **Ikkuna**
(76 px) näyttää sivun pienenä kuvana, mikä auttaa tunnistamaan ikkunan,
mutta kuva on liian pieni luettavaksi ja vie eniten tilaa.

Kokeile: oletusnäkymässä agentti odottaa, että vahvistat kirjautumisen.
Kaikki kolme paikkaa näkyvät heti. Käy tilat läpi yläreunan valitsimella
tai **Seuraava →** -painikkeella. Paina keskustelun **Ota ohjaus ja
hoida** ja sen jälkeen katselunäkymän **Valmis**. Avaa lopuksi Selain-kortti.
Puhelimessa sivupalkin avaa **Sivupalkki**.

### Suunnat

Akseli: miltä selain näyttää keskustelussa. Sivupalkin kaksi paikkaa ovat
samat kaikissa suunnissa. Korkeudet on mitattu tilassa *odottaa sinua*.

| Suunta | Keskustelussa | 1440 px | 390 px | Hinta |
| --- | --- | --- | --- | --- |
| 1 Rivi | Yksi rivi: *Odottaa sinua selaimessa: Vahvista kirjautuminen …* + Hoida, Katso ensin. Valmiista työstä jää Selain-kortti. | 28 px | 72 px | Kaksi eri muotoa (rivi, sitten kortti). Rivi hukkuu helposti pitkään vuoroon. |
| **2 Kortti** | Sama Selain-kortti koko ajan. Pyyntö ja painikkeet ovat otsikkorivillä, ja korostettu reuna kertoo, että agentti odottaa. Kortin voi avata, ja silloin näkyy käynnin luettelo tähän asti. | 56 px | 90 px | Odottava kortti on vain reunaltaan ja otsikkonsa väriltä erilainen kuin työssä oleva. Sana ja painike kantavat eron. |
| 3 Ikkuna | Kortissa on 96 px kuva ikkunasta, jossa agentti on tai joka odottaa sinua. Kuvaa painamalla avautuu katselunäkymä. | 76 px | 96 px | Vie eniten tilaa. Kuva ei ole luettava, ja se tarvitsee hostilta ikkunakuvat. |

Kierroksen 2 aikajanakehys oli yli 300 px korkea.

Yhteistä kaikille:

- **Tilat**: Ei auki, Lepo, Agentti työssä, Odottaa sinua, Sinä ohjaat ja
  Valmis. Annetun ohjauksen jälkeen agentti jatkaa. Keskusteluun tulee
  Habitat-rivi *Annoit selaimen takaisin 9.18*, ja osa palaa tilaan
  *työssä*.
- **Katselunäkymä** on ohjauskierroksen suunta 1 Kehys. Katkoviivareuna
  tarkoittaa, että agentti ohjaa, ja yhtenäinen vihreä, että sinä ohjaat.
  Vuoro, pyyntö ja **Valmis** tai **Ota ohjaus** ovat kielekkeessä.
  Katsominen ei ota ohjausta.
- **Käynnin merkintä** on hyväksytty kortti ikkunakuvakkeella. Avattuna
  siinä on uusi kohta *Sinä selaimessa: ohjasit selainta 9.16–9.18
  agentin pyynnöstä*. Sitä, mitä teit ohjatessasi, ei kirjata.
- **Toinen keskustelu** ei näytä selaimesta mitään. Pyyntö näkyy siellä
  sivupalkin kahdessa paikassa ja puhelimessa valikkopainikkeen merkissä.

### Questions for Jari

1. Valitaanko **2 Kortti**: sama Selain-kortti työn aikana, pyynnön
   aikana ja käynnin merkintänä?
2. Riittääkö keskustelurivin merkiksi rajattu ikkunakuvake ja sana
   *selain*, vai pitääkö odottavan rivin olla oma osionsa
   (esimerkiksi *Odottaa selaimessa* Sinun vuorosi -osion yllä)?
3. Saako Oma selain ikkunakuvakkeen, ja pitääkö Tuotokset maapallon?
   Vaihtoehto on päinvastainen: selain pitää maapallon, ja Tuotokset saa
   uuden kuvakkeen.

### Decisions for later review

- **Sivupalkin kaksi paikkaa ovat samat kaikissa suunnissa.** Vaihtoehtona
  olisi ollut vaihdella myös niitä. Silloin kolme muuttuvaa paikkaa olisi
  tehnyt vertailusta epäselvän. Toimeksiannon akseli oli keskustelun
  näkymä.
- **Oma selain saa ikkunakuvakkeen, ja Tuotokset pitää maapallon.**
  Tuotannossa maapallo on alun perin selaimen kuvake (kommentti
  `Icon.tsx`:ssä), ja Tuotokset lainasi sen. Tuotokset ovat kuitenkin
  julkisia osoitteita verkossa, mihin maapallo sopii. Ikkuna taas kertoo,
  että kyseessä on oma selain. Myös Selain-kortti saa saman ikkunakuvakkeen,
  jotta perhe tunnistetaan.
- **Oma selain on painike, joka näyttää linkkiriviltä.** Rivi avaa
  katselunäkymän eikä omaa sivua. Siksi rivi on `<button>`, jolla on
  Tuotokset-rivin luokat.
- **Odottava tila näkyy sivupalkissa pillerinä, ja tilan sana on mukana.**
  Pelkkä väri ei riittäisi, ja `aria-label` kertoo koko tilan ja
  keskustelun nimen.
- **Keskustelurivin selainmerkki korvaa ajan.** Vaihtoehto olisi ollut
  toinen rivi rivin alla, mutta yksirivisyys säästää sivupalkin tilaa
  (`rail-space-small-screens`). Ruudunlukija saa rivin kuvauksesta
  *Odottaa sinua selaimessa: vahvista kirjautuminen*.
- **Selain-kortti sijoittuu sen vuoron alle, joka käyttää selainta.**
  Vaihtoehto olisi ollut kiinnittää se kentän yllä olevaan kohtaan.
  Silloin se olisi taas ollut kierroksen 2 hylätty siru. Kun agentti
  pyytää, sen vuoro on päättynyt, joten kortti on keskustelun viimeinen
  kohta ilman erillistä kiinnitystä.
- **Ikkunasuunnan kuva** käyttää samaa ikkunakuvaa kuin tuotannon
  `BrowserStrip`. Uutta host-tietoa ei tarvita, mutta kuva haetaan
  keskusteluun.

### Toimitus ja näyttö

Lähteet: `design-system/prototypes/rounds/2026-11-22-server-browser-places/`.
Rakennus- ja tarkistuskomennot ovat sen `NOTES.md`:ssä. Rakennettu sivu
tällä työhostilla on
`/var/tmp/agent-keep/server-browser-entry-points/round-3/offline.html`
(`index.html` ilman fontteja samassa kansiossa). Tarkistuksen kuvat ja
`sizes.json` ovat alihakemistossa `check/`. Sivu ja kuvat eivät kuulu
gitiin.

`check.mjs`: **1255 tarkistusta läpi** 24 yhdistelmässä (3 suuntaa ×
1440/390 px × Päivä/Yö/Kontrasti suomeksi sekä Päivä englanniksi). Konsoli
on puhdas, ulkoisia pyyntöjä ei ole eikä vaakaylivuotoa.

Kierros on synteettinen komponenttilabra. Se ei todista noVNC-yhteyttä,
ikkunakuvien hakua keskusteluun eikä komentojen tulkintaa oikeasta
historiasta. Tuotantokoodia, sopimusta, daemonia ja käyttöoikeuksia ei
muutettu.

## Kierros 2 (historia)

### Saatesanat

Molempia ei tarvita. Nykyään siru ja sivupalkin rivi näyttävät saman koko
selaimen, ja siru on jokaisessa keskustelussa. Siksi agentin pyyntö avaa
nauhan myös keskusteluun, jolla ei ole selaimen kanssa mitään tekemistä.
Selaimia on yksi ja se on sinun, joten sen paikka on sivupalkissa.
Keskustelun kuuluu näyttää vain se, mitä sen oma agentti teki selaimessa.

Suosittelen **suuntaa 2, Rivi**. Sivupalkin **Oma selain** on ainoa ovi:
sieltä selaimen voi käynnistää, siellä voi kirjautua etukäteen ja nähdä
kaikki ikkunat. Keskustelussa, jonka agentti käyttää selainta, työ näkyy
agentin komentojen alla aikajanassa: sen kaksi ikkunaa, pyyntö sekä
painikkeet **Ota ohjaus ja hoida** ja **Katso ensin**. Kun työ on valmis,
siitä jää rivi. Toinen keskustelu pysyy puhtaana. Pyyntö näkyy siellä
sivupalkin rivillä ja Sinun vuorosi -osiossa, puhelimessa valikkopainikkeen
merkissä.

Keskustelun ja ikkunan yhteyttä varten ei tarvita uutta tietoa hostilta.
Keskustelun omat komennot kertovat sen: `agent browser goto` palauttaa
välilehden, ja `agent browser request --window` nimeää pyytävän ikkunan.
Jos yhteys ei löydy keskustelusta, pyyntö näkyy vain sivupalkissa. Omistajaa
ei arvata.

### Suunnat

Oletusnäkymä on kaikissa sama: agentti keskustelussa *Sähkölaskut 2026*
odottaa, että vahvistat kirjautumisen. Selaimessa on kaksi agentin
välilehteä ja yksi oma ikkuna. Sivun yläreunassa on kustakin suunnasta yksi
rivi ja suositus.

| Suunta | Mitä se päättää | Hinta |
| --- | --- | --- |
| 1 Siru | Selain asuu kentän yllä jokaisessa keskustelussa, kuten nyt. Sivupalkkiin tulee rivi vain, kun ikkuna odottaa, ja rivi kertoo, mikä keskustelu pyytää. | Pyyntö avaa nauhan myös asiaan liittymättömässä keskustelussa, puhelimessa lähes koko ruudun kokoisena. Selaimen avaaminen ilman keskustelua ei onnistu ilman sirua. |
| 2 Rivi | Sivupalkki on selaimen koti. Keskustelu näyttää vain oman agenttinsa selaintyön ja pyynnön omassa kulussaan, valmiista työstä jää rivi. | Elävä näkymä vierii ylös, jos keskusteluun kirjoitetaan agentin työskennellessä. Koko selaimen saa auki vain sivupalkista, puhelimessa valikon takaa. |
| 3 Kaksi | Sivupalkissa on koko selain. Siru on vain keskustelussa, jonka agentti käyttää selainta, ja siinä on vain sen ikkunat ja rajausrivi. | Kaksi ovea, joista sirun rajaus pitää selittää tekstillä. Siru katoaa, kun agentti on valmis, eikä työstä jää jälkeä keskusteluun. |

Kaikissa suunnissa toimivat Ota ohjaus ja hoida, Anna takaisin agentille
(jonka jälkeen agentti jatkaa), Katso isona, Escape, pysähtyneen selaimen
avaus suunnan omasta ovesta ja valmis keskustelu. Siru, nauha, sivupalkin
rivi ja katselunäkymä ovat tuotannon komponentteja.

### Questions for Jari

1. Valitaanko suunta 2: selain vain sivupalkissa, ja keskustelu näyttää oman
   agenttinsa selaintyön aikajanassa?
2. Riittääkö toisessa keskustelussa pyynnön merkiksi sivupalkin rivi ja
   Sinun vuorosi, vai pitääkö pyynnön näkyä kentän yllä jokaisessa
   keskustelussa? Jälkimmäinen on suunnan 1 käytös, joka nyt on tuotannossa.

### Decisions for later review

- **Keskustelun ikkunat luetaan keskustelun omista komennoista.**
  Vaihtoehtoina olisivat hostin raportoima keskustelutunniste tai yhteinen
  ikkunalista kaikkialla. Komennot ovat jo natiivissa historiassa, joten
  uutta varastoa tai sopimuskenttää ei tarvita. Toteutus tarvitsee
  sovelluskerrokseen komentojen tulkinnan (`goto`-tuloksen `tab`,
  `request --window`). Ellei yhteys löydy, ikkuna kuuluu vain sivupalkkiin.
- **Suunnassa 2 pyyntö ei avaa mitään itsestään.** Tuotanto avaa nauhan
  kerran uuden pyynnön tullessa. Suunnassa 2 pyyntö on keskustelun viimeinen
  kohta, ja agentin vuoro on päättynyt odottamaan, joten erillistä avausta
  ei tarvita.
- **Pyynnön jälkeen agentti jatkaa, kun ohjaus palautetaan.** Prototyyppi
  olettaa, että palauttaminen tarkoittaa vahvistuksen tehdyksi. Tuotannossa
  agentti tarkistaa sivun itse.
- **Suunnan 3 nimi on Kaksi, ei Molemmat.** Yhteinen valitsin ei saa
  rivittyä puhelimessa, ja pidempi nimi rivittyi.
- **Puhelimen valikkopainikkeen merkki näyttää pyynnön.** Tämä on tuotannon
  `navigationBadge`. Erillistä pysyvää selainpainiketta ei lisätty
  kolmanneksi oveksi.

### Toimitus ja näyttö

Lähteet: `design-system/prototypes/rounds/2026-11-22-server-browser-entry-points/`.
Rakennus- ja tarkistuskomennot ovat kierroksen `NOTES.md`:ssä. OpenAI-kierros
`2026-11-22-server-browser-entry` poistettiin, ja se on luettavissa
Git-historiasta.

Rakennettu sivu tällä työhostilla:
`/var/tmp/agent-keep/server-browser-entry-points/offline.html`. Tarkistuksen
kuvat ovat saman hakemiston `check/`-alihakemistossa. Hylätyn kierroksen
aineisto on siirretty alihakemistoon `discarded-openai-round/`. Sivu ja kuvat
eivät kuulu gitiin.

### Tarkistus ja rajat

- Kierroksen `check.mjs` antoi **531 tarkistusta läpi** 24 yhdistelmässä:
  3 suuntaa × 1440/390 px × Päivä/Yö/Kontrasti suomeksi sekä Päivä
  englanniksi. Mukana olivat `picker-check.mjs`, vaakaylivuoto, ulkoisten
  pyyntöjen puuttuminen ja konsoli. Konsoli pysyi puhtaana.
- Kierros on synteettinen komponenttilabra. Se ei todista noVNC-yhteyttä,
  ikkunakuvien hakua eikä komentojen tulkintaa oikeasta historiasta.
  Tuotantokoodia, sopimusta, daemonia tai käyttöoikeuksia ei muutettu.
