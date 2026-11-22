# Palvelinselaimen paikka: sivupalkki, siru vai molemmat

## Saatesanat

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

## Suunnat

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

## Questions for Jari

1. Valitaanko suunta 2: selain vain sivupalkissa, ja keskustelu näyttää oman
   agenttinsa selaintyön aikajanassa?
2. Riittääkö toisessa keskustelussa pyynnön merkiksi sivupalkin rivi ja
   Sinun vuorosi, vai pitääkö pyynnön näkyä kentän yllä jokaisessa
   keskustelussa? Jälkimmäinen on suunnan 1 käytös, joka nyt on tuotannossa.

## Decisions for later review

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

## Toimitus ja näyttö

Lähteet: `design-system/prototypes/rounds/2026-11-22-server-browser-entry-points/`.
Rakennus- ja tarkistuskomennot ovat kierroksen `NOTES.md`:ssä. OpenAI-kierros
`2026-11-22-server-browser-entry` poistettiin, ja se on luettavissa
Git-historiasta.

Rakennettu sivu tällä työhostilla:
`/var/tmp/agent-keep/server-browser-entry-points/offline.html`. Tarkistuksen
kuvat ovat saman hakemiston `check/`-alihakemistossa. Hylätyn kierroksen
aineisto on siirretty alihakemistoon `discarded-openai-round/`. Sivu ja kuvat
eivät kuulu gitiin.

## Tarkistus ja rajat

- Kierroksen `check.mjs` antoi **531 tarkistusta läpi** 24 yhdistelmässä:
  3 suuntaa × 1440/390 px × Päivä/Yö/Kontrasti suomeksi sekä Päivä
  englanniksi. Mukana olivat `picker-check.mjs`, vaakaylivuoto, ulkoisten
  pyyntöjen puuttuminen ja konsoli. Konsoli pysyi puhtaana.
- Kierros on synteettinen komponenttilabra. Se ei todista noVNC-yhteyttä,
  ikkunakuvien hakua eikä komentojen tulkintaa oikeasta historiasta.
  Tuotantokoodia, sopimusta, daemonia tai käyttöoikeuksia ei muutettu.
