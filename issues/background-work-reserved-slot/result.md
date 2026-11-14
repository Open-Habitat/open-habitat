# Tulos: varattu taustapaikka yhteenvedoille

## Mitä tehtiin

- **Varattu paikka** (`internal/daemon/background_linux.go`). Ihmisen raja on
  N omaa Pi:tä ja lisäksi yksi paikka järjestelmän taustatyölle. Paikassa on
  Pi, joka on käynnistetty vain yhteenvetoa varten (`backgroundSlot` ja
  `recapOnly`) ja jonka työ on kesken. Ihmisen paikkoihin lasketaan kaikki
  muut elävät Pi:t (`liveCount`). Tämän rajan perusteella `makeRoom`,
  luonti, viestin käynnistämä Pi ja herätykset tekevät tilaa tai
  kieltäytyvät. Taustatyön Pi ei siksi koskaan vie ihmisen paikkaa, eikä
  `makeRoom` pysäytä sitä. Kapasiteettivastaus ei myöskään näytä sitä
  ihmisen paikkoja pitävien joukossa.
- **Yksi jono.** Sekä tyhjäkäyntipysäytys (`stopExpiredIdlePi`) että tilaa
  tekevä pysäytys (`makeRoom`) antavat velaksi jääneen yhteenvedon samaan
  jonoon (`handOnOwedRecaps`). Jono ajaa työt yksi kerrallaan, aikaisimmin
  erääntyvä ensin. Erääntymisaika on sama kuin pysäytetyn ajastimen, ja se
  siirtyy myöhemmäksi niin kauan kuin ihminen lukee keskustelua (sama sääntö
  kuin entisessä `recapAfterIdleStop`issa, joka poistui). Jono aloittaa työn
  vasta, kun varattu paikka on vapaa. Kun työn vuoro tulee, natiivi historia
  ratkaisee, onko yhteenveto yhä velkaa (`owedRecaps`).
- **Uudelleenkäynnistys.** `recapRestingConversations` johtaa
  käynnistyksessä velaksi jääneet yhteenvedot natiivista historiasta, kuten
  ennenkin, ja antaa ne samaan jonoon. Uutta tallennetta ei tullut.
- **Herätykset** (lähetys, ihmisen herätys, Habitatin oma herätys)
  käyttävät tavallisia paikkoja kuten ennenkin.
- Testit (`background_linux_test.go`):
  - tilan tekeminen antaa velaksi jääneen yhteenvedon taustapaikalle, ja
    kokonaismäärä on silloin N+1, josta ihmisen omia N;
  - kun taustatyö on käynnissä, ihmisen seuraava aloitus pysäyttää hänen
    oman joutilaan Pi:nsä, ei taustatyön Pi:tä;
  - ryöpyn yhteenvedot tehdään yksi kerrallaan;
  - uudelleenkäynnistynyt daemon johtaa odottavan yhteenvedon natiivista
    historiasta ja tekee sen, vaikka kaikki ihmisen paikat ovat varattuina.

  Kaksi mutaatiota tarkistettiin: ilman `makeRoom`in luovutusta ja ilman
  paikkalaskentaa testit kaatuvat.

- **Muistissa pidettävien keskustelutietueiden raja** on nyt
  `livelimits.Max + 1` (129). Eläviä tietueita ei poisteta, joten
  korkeimmalla sallitulla rajalla (128) taustatyön Pi tarvitsee yhden
  tietueen lisää.
- **Selaintesti.** `recap-resting.spec.ts` todisti ennen, että raja 1 ei
  jätä tilaa palautukselle. Taustapaikka ei kuitenkaan koskaan täyty
  ihmisen rajasta, joten testi estää nyt palautuksen Pi:n käynnistymisen
  uudella testipalvelimen kytkimellä `/fixture/pi-start-fail`.

Sopimus, käyttöliittymä ja asennus eivät muuttuneet.

## Katselmointi

Riippumaton `/llm-review` (etsijä gpt-6-astra, tarkistaja claude-fable-5-2)
ja `/assess-findings`. Kaksi korjausta tehtiin:

- tietueraja korkeimmalla rajalla;
- Pi, jonka pysäytystä ei saatu varmistettua, siirtyi ihmisen paikoille.
  Nyt se pitää taustapaikan, kunnes se on korjattu pois.

Viisi löydöstä hylättiin. Ne kuvasivat aiempaa käytöstä, joka ei muuttunut,
tai harvinaista tilannetta, jonka korjaus ei selkeytä koodia. Mitään ei
kirjattu uudeksi issueksi.

## Päätökset myöhempään katselmointiin

- **Ihminen ottaa taustatyön Pi:n.** Jos ihminen kirjoittaa, herättää tai
  ajaa komennon Pi:ssä, joka on käynnissä yhteenvedon takia, Pi siirtyy
  hänen paikoilleen. Tällöin hänellä voi hetken olla N+1 omaa Pi:tä.
  Kokonaismäärä pysyy kuitenkin enintään N+1:ssä, koska jono ei aloita uutta
  työtä ennen kuin kokonaismäärä on alle N+1. Ihmisen seuraava aloitus
  tekee tilaa kahdelle.
  - Vaihtoehto: kieltäytyä ottamasta Pi:tä tai pysäyttää se. Tämä
    keskeyttäisi ihmisen.
- **Ihminen lukee keskustelua yhteenvedon aikana.** Pi jätetään
  tyhjäkäyntipysäytyksen hoidettavaksi kuten ennenkin, mutta se vapauttaa
  taustapaikan ja lasketaan ihmisen paikkoihin.
  - Vaihtoehto: pitää Pi taustapaikassa. Tämä pysäyttäisi jonon niin
    pitkäksi aikaa kuin keskustelu on auki.
- **Varattu paikka varattuna.** Kun paikka on varattu, jono tarkistaa
  tilanteen kahden sekunnin välein. Paikkaa ei kysytä tapahtumista, mikä
  pitää koodin yksinkertaisena. Tarkistus pyörii vain silloin, kun jonossa
  on erääntynyttä työtä.
- **Yhteenvedon ja ihmisen aloituksen kilpajuoksu.** Jos ihminen ottaa Pi:n
  tarkistuksen ja käynnistyksen välissä, `recapResting` kirjaa yhteenvedon
  kirjoittamatta jääneeksi (`not_written`) kuten ennen. Työtä ei laiteta
  jonoon uudelleen.

## Live check

Avaa testipalvelimella yli 32 keskustelua (tai pienennä raja ylläpidossa
esim. kahteen). Käy keskustelussa A vuoro loppuun ja aloita heti uusia
keskusteluja niin, että A pysäytetään tilan tekemiseksi. Kun yhteenvedon
viive on kulunut, A:lle ilmestyy yhteenveto, eikä mikään avoimista
keskusteluista pysähdy sen vuoksi.
