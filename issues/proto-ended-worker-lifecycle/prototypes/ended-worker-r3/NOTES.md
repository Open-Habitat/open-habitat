# Päättyneet workerit · Kierros 3

Päätit kierroksen 2 jälkeen (28.10.), että *Kerro agentille* on itse
toiminto eikä luonnos. Painallus lähettää agentille pyynnön käsitellä juuri
sen worktreen. Agentti tarkistaa työn ja suosittelee, mitä sille tehdään
(mergeä, jatka tai hylkää), ja sinä vastaat keskustelussa. Lisäksi
*Käsittele kaikki* lähettää yhden pyynnön kaikista keskeneräisistä riveistä.
Kierrokset 1 ja 2 ovat vertailun vuoksi yhä hakemistoissa `../ended-worker/`
ja `../ended-worker-r2/`.

## Mikä on nyt kaikissa vaihtoehdoissa sama

- **Painikkeet ovat kolmessa paikassa.** Rivin *Kerro agentille*,
  Workerit-paneelin Päättyneet-otsikon *Käsittele kaikki (n)* sekä sirun
  vieressä oleva *Käsittele kaikki (n)*, joka näkyy niin kauan kuin
  jokin keskeneräinen rivi odottaa pyyntöä. Yhdestä keskeneräisestä
  siru sanoo vain *Käsittele*. Sama painike on myös workerin näkymän
  alalaidassa. Siru on tuotannossa kentän yllä eikä yläpalkissa, joten
  se on prototyypissäkin siinä.
- **Pyyntö lähtee heti** eikä mene kenttään luonnokseksi. Se on sinun oma
  viestisi keskustelussa, aivan kuin olisit kirjoittanut sen itse. Siinä on
  workerin nimi, Taskfleet-ajon tunnus, haara ja worktreen polku, joten
  agentti löytää työn, vaikka se ei olisi itse käynnistänyt workeria.
  Viesti päättyy lauseeseen *Älä muuta mitään ennen kuin vastaan*.
  Siksi vahvistusta ei tarvita: väärä painallus maksaa yhden agentin
  vuoron, eikä mitään muutu.
- **Agentti suosittelee** (synteettinen vastaus): se kertoo, mitä näki
  (commitit, törmäykset, testit), suosittelee yhtä vaihtoehtoa perusteluineen
  ja kertoo muut. Esimerkiksi mergeämätön työ mergetään, peruttu
  hylätään ja keskeytynyt jatkuu. *Käsittele kaikki* -vastauksessa on yksi
  kohta per worker ja lopussa kysymys *Teenkö nämä kaikki?*.
- **Sinä vastaat tavallisena viestinä**, esimerkiksi ”kyllä”, ”hylkää”,
  ”mergeä 1, jätä muut” tai ”jätä toistaiseksi”.
- **Rivi kertoo, missä pyyntö on menossa.** Punainen pallo vaihtuu
  pyöriväksi renkaaksi: *pyyntö jonossa*, *pyyntö lähetetty*, *agentti
  tarkistaa* ja sitten *odottaa vastaustasi* (pysähtynyt rengas, kuten
  sivupalkin *Odottaa sinua*), ja vastauksesi jälkeen *agentti mergeää /
  hylkää / jatkaa ajoa*. Rivillä lukee myös, missä keskustelussa pyyntö on,
  ja painike *Näytä/Avaa keskustelu* vie sinne. Jos vastaat ”jätä
  toistaiseksi”, rivi palaa punaisen pallon kanssa.
- **Rivi poistuu**, kun agentti on poistanut haaran ja worktreen. Hetken
  ajan rivillä on vihreä ✓ ja yliviivattu nimi (*mergetty · haara ja
  worktree poistettu*), sitten se taittuu pois. Paneelin alalaitaan tulee
  ilmoitus *… poistui Workerit-listasta*. Jatkettu ajo siirtyy käynnissä
  oleviin. Kun mitään ei ole jäljellä, siru katoaa.

## Mitä kierros vertailee: mikä keskustelu saa pyynnön

| Vaihtoehto | Kuka saa pyynnön | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Vanhempi | Aina keskustelu, joka käynnisti workerin. Workerit-paneeli on vain siinä, joten se on myös se keskustelu, jossa olet. Jos agentti on kesken vuoron, pyyntö menee jonoon ja lähtee vuoron päätyttyä. Jos keskustelu on suljettu, lähetys jatkaa sitä. | Agentti tietää, miksi worker käynnistettiin. Kaikki tapahtuu yhdessä paikassa, ja yksi painallus riittää. | Käsittely tulee keskelle meneillään olevaa keskustelua ja odottaa sen vuoroa. Jos keskustelu on ajettu päätteessä (tmux), selain ei voi kirjoittaa siihen, ja pyyntö lähtee pakostakin uuteen keskusteluun. |
| 2 Valittava | Oletuksena sama kuin 1. Painikkeen vieressä oleva ▾ avaa valinnan: tämä keskustelu, muut saman työtilan keskustelut tai uusi keskustelu. Pääteistunto näkyy valinnassa harmaana. | Tavallinen tapaus on yksi painallus, ja kiireisen keskustelun voi kiertää. | Jokaisessa painikkeessa on toinen puolikas, ja valinnassa on keskusteluja, jotka eivät tiedä workerista mitään. |
| 3 Uusi keskustelu | Jokainen painallus aloittaa uuden keskustelun workerin työtilassa (*Worker: …* tai *Workereiden käsittely*). Pyyntö kertoo myös, mikä keskustelu workerin käynnisti. | Pääkeskustelu ei keskeydy eikä jonota, ja suljettu tai pääteistunto ei haittaa. Jokaisella siivouksella on oma keskustelunsa. | Uusi agentti aloittaa tyhjästä, ja sivupalkkiin kertyy keskusteluja. Sinun täytyy siirtyä toiseen keskusteluun vastaamaan. Jokainen painallus käynnistää uuden Pi:n. |

Suosittelen vaihtoehtoa **1 Vanhempi**: agentti, joka käynnisti workerin,
tuntee sen tarkoituksen ja pystyy siksi suosittelemaan parhaiten. Lisäksi
vastaat samassa näkymässä, jossa rivi on. Uusi keskustelu tarvitaan vain
silloin, kun selain ei voi kirjoittaa pääkeskusteluun. Vaihtoehto 1 tekee
sen jo automaattisesti ja kertoo siitä.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r3/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Valitsin on ylhäällä, ja
vaihtoehto vaihdetaan näppäimillä **1–3** tai **←/→**. **Tilanne** vaihtaa
kaikkien tilojen (*Iltakierros*) ja oman tapauksesi välillä. **Iltakierros**
asettaa pääkeskustelun tilan: *odottaa sinua*, *työskentelee*, *suljettu*
tai *pääteistunto (vain luku)*. **Tumma/Vaalea** vaihtaa teeman.

1. Valitse *Jarin tapaus* ja avaa siru. Paina rivin *Kerro agentille*.
   Katso, millaisena viestinä pyyntö lähtee ja miten rivi muuttuu.
2. Kun agentti on suositellut, kirjoita kenttään ”kyllä” ja lähetä. Rivi
   poistuu, ja siru katoaa.
3. Vaihda *Iltakierrokseen* ja paina *Käsittele kaikki* (paneelin otsikossa
   tai sirun vieressä). Vastaa ”kyllä” tai esimerkiksi ”mergeä 1, jätä
   muut”.
4. Aseta *Iltakierros: työskentelee* ja paina jotakin riviä: pyyntö menee
   jonoon (vaihtoehdot 1 ja 2). Kokeile myös *suljettu* ja *pääteistunto*.
5. Vaihtoehdossa 2 avaa ▾ ja lähetä pyyntö *Sääaseman kalibrointiin*.
   Vaihtoehdossa 3 avaa uusi keskustelu rivin *Avaa keskustelu* -painikkeesta.

Kuvat (device scale factor 2, AVIF; aukeavat selaimessa) ovat `evidence/`-hakemistossa. Oma
tapauksesi on kuvattu kaikissa leveyksissä ja teemoissa. Muut vaiheet on
kuvattu työpöydällä vaaleana ja tärkeimmät puhelimessa tummana.

## Kysymykset sinulle

1. Mikä keskustelu saa pyynnön: vanhempi (1), vanhempi tai valittu (2)
   vai aina uusi (3)?
2. Riittääkö viestin viimeinen lause (*Älä muuta mitään ennen kuin vastaan*)
   suojaksi, vai pitäisikö *Käsittele kaikki* -painikkeen kysyä ensin?
3. Pitäisikö jo mergetyn rivin (*Kuvien pakkaus*, vain siivous jäljellä)
   kuulua *Käsittele kaikki* -pyyntöön? Nyt se ei kuulu, koska se ei ole
   keskeneräinen.
