# Päättyneet workerit · Kierros 2

Päätit kierroksen 1 jälkeen (28.10.), ettei kuittausta tehdä. Lista
heijastaa todellista tilaa: kun agentti siivoaa worktreen ja haaran, rivi
katoaa. Keskeneräisellä rivillä on punainen pallo, ja siihen reagoidaan
yleensä sanomalla agentille jotakin. Tämä kierros rakentuu kierroksen 1
suunnan 2 (*Ratkaisu*) varaan ilman kuittausta ja ilman vuorokauden
odotusaikaa. Kierros 1 on vertailun vuoksi yhä hakemistossa `../ended-worker/`.

## Mikä on nyt kaikissa vaihtoehdoissa sama

- **Rivi näkyy niin kauan kuin sen haara tai worktree on olemassa.**
  Laskeutunut worker ja ilman työtä epäonnistunut worker eivät jätä levylle
  mitään, joten niiden rivi katoaa heti, kun ne päättyvät. Agentti kertoo
  lopputuloksen keskustelussa. Paneelin alalaidassa on sama sääntö yhtenä
  rivinä.
- **Punainen pallo tarkoittaa keskeneräistä**: levyllä on työtä, joka ei ole
  vielä päähaarassa. Pallo on rivillä, joka on mergeämättä, peruttu (työ
  tallessa) tai keskeytynyt. Rivillä, joka on jo mergetty mutta jonka
  worktree on jäänyt levylle, on merge-merkki eikä palloa.
- **Siru ei enää näytä 0:aa ja pistettä.** Siinä on yksi merkki jokaista
  käynnissä olevaa workeria kohti ja yksi punainen pallo jokaista
  keskeneräistä riviä kohti. Sinun tapauksessasi siinä on haaran kuva ja
  yksi pallo. Kun listattavaa ei ole, siru katoaa.
- **Kerro agentille** on jokaisella päättyneellä rivillä. Se avaa pyynnöt:
  Pyydä mergeämään, Uusi worker samasta haarasta, Pyydä hylkäämään,
  keskeytyneelle Pyydä jatkamaan, ja lisäksi Kirjoita oma viesti. Pyyntö
  kirjoittuu pääkeskustelun kenttään luonnoksena, ja mitään ei tapahdu
  ennen kuin lähetät sen. Jokaisen pyynnön alla lukee, mitä agentti ajaa
  (`git rebase + merge`, `taskfleet run salvage`, `taskfleet run discard`
  ja niin edelleen). Kun agentti on poistanut haaran ja worktreen, rivi
  katoaa.

## Mitä kierros vertailee: mitä selain poistaa itse

Mainitsit, että rivillä voi olla painike worktreen poistamiseen. Selaimessa
on jo valmiina worktreen poisto (työtilan ja Oman tallennustilan
worktree-lista). Se toimii myös Taskfleetin worktreelle, kun ajo on
Taskfleetin mukaan päättynyt. Käynnissä olevan ajon worktreetä se ei poista.
Se poistaa haaran vain silloin, kun haara on jo mergetty. Muuten haara jää
talteen. Juuri tästä syystä vaihtoehdot eroavat:

| Vaihtoehto | Selain poistaa itse | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Pyyntö | Ei mitään. Kaikki menee agentille, myös jo mergetyn worktreen siivous. | Yksi tie ja yksi painike. Kaikki muutokset tekee agentti. | Siivouskin vaatii agentin vuoron, vaikka mitään ei voisi hävitä. |
| 2 Yhdistetty | Vain worktreen, jonka haara on jo mergetty. Worktree ja haara poistuvat, mitään ei häviä, ja rivi katoaa. | Selaimen ainoa painike tekee aina sen, minkä lupaa: rivi lähtee. | Painike näkyy harvoin: vain silloin, kun agentti on mergennyt käsin ja jättänyt worktreen. |
| 3 Worktree | Minkä tahansa worktreen, jonka nykyinen poisto hyväksyy. Mergeämättömän haara jää, joten rivi ja pallo jäävät (”haara tallessa, worktree poistettu”). Commitoimattomat muutokset tallennetaan haaraan tai poistetaan pakolla, kun kirjoitat nimen. Keskeytyneen ajon worktreetä ei voi poistaa. | Levyn ja editorin saa siivottua heti ilman agenttia. | Sinun tapauksessasi painike ei vie riviä eikä palloa. Pakkopoisto hävittää perutun ajon commitoimattoman työn, mikä on lähellä sitä, että selain hylkäisi työn itse. |

Suosittelen vaihtoehtoa **2**. Siinä jokainen selaimen painike noudattaa
sääntöäsi: rivi lähtee, koska työ on oikeasti valmis eikä mitään häviä.
Kaikki keskeneräinen menee agentille.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r2/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Valitsin on ylhäällä, ja
vaihtoehto vaihdetaan näppäimillä **1–3** tai **←/→**. **Tilanne** vaihtaa
kaikkien tilojen (*Iltakierros*) ja oman tapauksesi välillä. **Kastelu
laskeutuu** ja **Rajapinta epäonnistuu** päättävät käynnissä olevan workerin.
**Tumma/Vaalea** vaihtaa teeman.

1. Valitse *Jarin tapaus*. Katso sirua: onko yksi punainen pallo selvempi
   kuin 0 ja piste?
2. Avaa siru ja paina rivin *Kerro agentille*. Löytyykö se, mitä haluaisit
   sanoa? Jos ei löydy, kokeile *Kirjoita oma viesti*.
3. Valitse *Pyydä mergeämään* ja lähetä luonnos. Agentti vastaa, rivi
   katoaa, ja kun muuta ei ole, siru katoaa myös.
4. Vaihda *Iltakierrokseen* ja paina *Kastelu laskeutuu* ja *Rajapinta
   epäonnistuu*. Kummankin rivi katoaa heti, ja lopputulos näkyy vain
   keskustelussa. Onko se oikein?
5. Kokeile vaihtoehdoissa 2 ja 3 roskakoria: *Kuvien pakkaus* (mergetty) ja
   vaihtoehdossa 3 myös oma tapauksesi sekä *Lomakkeen saavutettavuus*
   (commitoimattomia muutoksia). Katso, jääkö rivi.
6. Avaa *Sääaseman CSV-vienti* vaihtoehdossa 3: miksi worktreetä ei voi
   poistaa.

Kuvat (device scale factor 2) ovat `evidence/`-hakemistossa. Oma
tapauksesi on kuvattu kaikissa leveyksissä ja teemoissa. Muut vaiheet on
kuvattu työpöydällä vaaleana ja tärkeimmät puhelimessa tummana.

## Kysymykset sinulle

1. Poistaako selain jotain itse? Jos poistaa, poistaako se vain sen, mitä ei
   voi hävitä (2), vai kaiken, minkä nykyinen poisto hyväksyy (3)?
2. Onko oikein, että laskeutunut tai epäonnistunut worker katoaa paneelista
   heti ja vain keskustelu kertoo siitä?
3. Ovatko sirun punaiset pallot parempi kuin 0 ja piste?
