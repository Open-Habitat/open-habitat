# Päättyneet workerit · Kierros 1

Lähtökohta on pilot.456:n tilanne kuvakaappauksestasi. Worker *test-guide:
worker-näkymän koe* päättyi klo 07.36 mergeämättä, ja sen työ jäi haaraan.
Rivi jää Workerit-paneelin Päättyneet-listaan, eikä siitä pääse eroon.
Siru näyttää 0 ja punaisen pisteen.

## Miksi riviä ei saa nyt pois

- Daemon näyttää jokaisen Taskfleet-ajon, jonka tämän keskustelun Pi on
  käynnistänyt (enintään 20). Taskfleet säilyttää ajot levyllä pysyvästi,
  eikä sillä ole arkistointi- tai unohda-komentoa. Selaimella ei ole omaa
  piilotustilaa. *Poista päättyneet* poistaa vain prosessit: workerit ovat
  Taskfleetin ajoja.
- Punainen piste tarkoittaa, että haara tai worktree on yhä olemassa
  (päätöksesi 16.10.: piste pysyy, kunnes haara on mergetty tai hylätty).
  Se ei siis lähde katsomalla.
- Sinun tapauksesi on Taskfleetille `done` ilman laskeutumista. Siihen ei
  Taskfleetin omilla komennoilla pääse: `run discard` hyväksyy vain
  epäonnistuneen tai perutun ajon, ja `run salvage` kieltäytyy päättyneestä
  ja perutusta. Työn voi viedä perille tai hylätä vain Gitillä, eli
  agentti tai sinä teet sen käsin.

## Mitä kierros vertailee

Kaikissa kolmessa suunnassa on sama sisältö: keskustelu *Iltakierros*
(repositorio `kasvimaa`), yksi käynnissä oleva worker ja viisi päättynyttä,
yksi kustakin tilasta:

| Rivi | Tila | Taskfleet |
| --- | --- | --- |
| test-guide: worker-näkymän koe | ei mergetty · työ tallessa | `done`, ei laskeutunut, haara tallessa (sinun tapauksesi) |
| Lomakkeen saavutettavuus | peruttu · työ tallessa | `cancelled`, haara tallessa |
| Sääaseman CSV-vienti | keskeytyi · jatkettavissa | `running`, mutta valvoja ei ole käynnissä; worktree tallessa |
| Kuvien pakkaus | laskeutui | `done`, laskeutui |
| Vanhan rajapinnan poisto | epäonnistui · ei tallessa olevaa työtä | `failed`, ei haaraa |

Myös toiminnot ovat samat kaikissa suunnissa. Ne avautuvat rivin `⋯`:stä ja
workerin näkymän alalaidasta, ja ne on ryhmitelty lajin mukaan:

- **Katso · ei muuta mitään**: Raportti, Muutokset (tiedostot ja rivimäärät
  haarassa mainiin verrattuna) ja Worktree editorissa.
- **Pyydä pääagentilta · luonnos kenttään, sinä lähetät**: Pyydä
  mergeämään, Uusi worker samasta haarasta, Pyydä jatkamaan samaa ajoa
  (keskeytynyt), Pyydä hylkäämään työ. Jokaisen alla lukee, mitä agentti
  ajaa: `git rebase + merge`, `taskfleet run salvage`, `taskfleet run
  reattach`, `taskfleet run discard --force` tai `git worktree remove + git
  branch -D`. Painallus ei tee mitään itse. Se kirjoittaa pyynnön
  pääkeskustelun kenttään, ja kentän yläpuolella lukee *Mitään ei tapahdu
  ennen kuin lähetät*. Selain ei siis mergeä, hylkää eikä peru ajoa.
- **Vain tämä näkymä**: Kuittaa (vain suunnassa 1).

Kierros vertailee yhtä asiaa: **mikä vie päättyneen rivin pois listasta.**

## Kolme suuntaa

| Suunta | Mikä vie rivin pois | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Kuittaus | **Sinä.** Jokaisella päättyneellä rivillä on ✓ Kuittaa. Kuitattu rivi siirtyy taitettuun *Kuitatut*-osaan, josta sen saa palautettua. Jos rivillä on tallessa olevaa työtä, Kuittaa kysyy ensin: ”Työ jää haaraan … Kuittaus vain piilottaa rivin ja punaisen pisteen.” Ratkaistu rivi (esimerkiksi agentin mergeämä) jää listaan uudella tilallaan, kunnes kuittaat sen. | Nopein tapa päästä eroon rivistä, myös silloin, kun haluat jättää päätöksen myöhemmäksi. | Kuittaus vie pisteen, vaikka haara on yhä levyllä, mikä on päinvastoin kuin päätöksesi 16.10. Kuittaukset ovat uusi tallennettava tieto, jota Taskfleet ei tunne: toinen totuus ajoista. |
| 2 Ratkaisu | **Työ itse.** Kuittausta ei ole. Rivi, jolla on haara, pysyy listassa punaisen pisteen kanssa, kunnes työ on mergetty tai hylätty. Rivi, jolla haaraa ei ole (laskeutunut, epäonnistunut ilman työtä tai juuri ratkaistu), poistuu vuorokauden kuluttua päättymisestä. Paneelin alalaidassa kerrotaan tämä sääntö. | Lista ja piste kertovat aina totuuden. Uutta tallennettavaa ei tarvita, sillä päättymisaika on jo tiedossa. | Jos haluat pitää haaran mutta lakata näkemästä sitä, et voi. Ainoa tie pois on päättää. |
| 3 Siivous | **Sääntö, heti.** Paneelissa ovat vain käynnissä olevat ja *Odottaa päätöstäsi* -ryhmä, joka on auki ilman taittoa. Muut päättyneet ovat linkin *Workerihistoria · 2 ›* takana. Ratkaistu rivi siirtyy historiaan heti, kun agentti on tehnyt pyydetyn. | Paneeli on lyhin, ja huomiota vaativa työ on näkyvillä eikä taitetun alla. | Laskeutunut worker katoaa paneelista heti, joten paneelista ei näe, mitä juuri valmistui (keskustelusta näkee). Lisäksi tarvitaan historianäkymä, ja 20 rivin raja tulee siinä vastaan. |

Kaikissa suunnissa rivin nimi avaa workerin näkymän. Päättyneellä
workerilla on siinä välilehdet **Raportti** (lopputulos, haara, worktree
ja Taskfleetin tila), **Muutokset** ja **Keskustelu**. Alalaidassa lukee
”Mitä tälle työlle tehdään?”, ja sen alla ovat samat toiminnot kuin
rivillä.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-ended-worker-lifecycle/prototypes/ended-worker/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Valitsin on ylhäällä, ja
suuntaa vaihdetaan näppäimillä **1–3** tai **←/→**. **Tilanne** vaihtaa
kaikkien tilojen (*Iltakierros*) ja oman tapauksesi (*Jarin tapaus*)
välillä. **Vuorokausi myöhemmin** siirtää kelloa päivällä, mikä muuttaa
vain suuntaa 2. **Tumma/Vaalea** vaihtaa teeman.

1. Valitse *Jarin tapaus*, avaa siru ja Päättynyt. Mitä tekisit
   rivillä, ja löytyykö se toiminto?
2. Avaa `⋯` ja katso, mitkä toiminnot vain katsovat, mitkä ovat pyyntöjä
   agentille ja mitä agentti silloin ajaa.
3. Paina *Pyydä mergeämään*. Pyyntö menee kenttään, eikä mitään tapahdu.
   Lähetä se: agentti vastaa, ja rivi muuttuu (1: jää *mergetty käsin*
   -tilaan kuitattavaksi, 2: poistuu vuorokauden kuluttua, 3: siirtyy
   historiaan).
4. Kokeile suunnassa 1 Kuittaa tallessa olevalle työlle ja suunnassa 2
   *Vuorokausi myöhemmin*.
5. Avaa *Lomakkeen saavutettavuus* ja sen *Muutokset*-välilehti.

Kuvat (device scale factor 2) ovat `evidence/`-hakemistossa. Paneeli ja
oma tapauksesi on kuvattu kaikissa leveyksissä ja teemoissa, ja muut
vaiheet työpöydällä vaaleana ja puhelimessa tummana.

## Kysymykset sinulle

1. Kumpi kuvaa paremmin sitä, mitä halusit: saada rivin pois kuittaamalla
   (1) vai saada työ ratkaistuksi, jolloin rivi lähtee itsestään (2 tai 3)?
2. Jos valitset 2 tai 3: tarvitaanko silti *Päätän myöhemmin*, joka
   piilottaisi tallessa olevan työn ilman pistettä? Se tarkoittaisi samaa
   tallennettavaa tietoa kuin suunnassa 1.
3. Riittääkö, että pyyntö menee kenttään luonnoksena, vai pitäisikö
   hylkäyksen olla suora painike? Daemon voisi ajaa `taskfleet run
   discard` sinun tunnuksillasi, mutta silloin selain hylkäisi ajon itse,
   ja issue rajasi juuri sen pois.
