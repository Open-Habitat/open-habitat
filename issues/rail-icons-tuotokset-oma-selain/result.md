# Sivupalkin paikkojen kuvakkeet – tulos

## Saatesanat

Piirsin sivupalkin paikoille kolme kuvakesarjaa ja näytän ne siellä, missä
niitä käytetään: mukautuvan sivupalkin kuvakerivissä, ruuduissa ja riveissä,
tilamerkkien ja vihjeiden kanssa, päivällä ja yöllä sekä pikseleinä 1x- ja
2x-tiheydellä. Kaikki sarjat noudattavat tuotannon tyyliä: 24 yksikön
ruudukko ja 1,8 viiva.

Suosittelen suuntaa **A Esineet**. Tuotokset on lokero, jossa on sivu, Oma
selain on selainikkuna ja Agentin käytössä on pistoke. Esineen tunnistaa
nopeimmin ilman nimeä. Ikkuna on sama merkki kuin keskustelurivin
selainmerkki, jonka hyväksyit Kortti-kierroksella. Pistoke vastaa sitä, mitä
sivu oikeasti on: yhdistetyt palvelut ja kansiot, joita agentti käyttää
sinun tunnuksillasi. Kilpi ja huutomerkki lupasivat turvallisuutta ja
varoitusta, joita sivulla ei ole.

**B Merkitykset** erottuu numeroina parhaiten, mutta sen kuvakkeet täytyy
opetella. Lisäksi sen Etusivu (Habitatin aurinko ja kaari) näyttää 18 px
koossa henkilöltä tai kellolta. **C Kaksisävy** on A sävytettynä. Se antaa
paikoille massaa, mutta talo ja lokero lähenevät toisiaan. C on hyvä varaus,
jos A tuntuu 16 px koossa liian ohuelta.

## Sivu

Rakennettu itsenäinen sivu tällä työhostilla:
`/var/tmp/agent-keep/rail-icons-tuotokset-oma-selain/offline.html`.
Lähteet ovat hakemistossa
`design-system/prototypes/rounds/2026-11-22-rail-icons/`, ja rakennus- ja
tarkistuskomennot ovat sen `NOTES.md`:ssä. Tarkistuksen kuvat ovat
hakemistossa `/var/tmp/agent-keep/rail-icons-tuotokset-oma-selain/check/`.
Valitsimessa ovat A Esineet, B Merkitykset, C Kaksisävy ja Nyt. Kaikki nimet
ja sisällöt ovat keksittyjä.

## Akseli ja suunnat

Akseli on **kuvakkeen idea**. Sisältö, tilat ja paikkojen järjestys ovat
kaikissa suunnissa samat.

| Paikka | A Esineet | B Merkitykset | C Kaksisävy | Nyt |
| --- | --- | --- | --- | --- |
| Etusivu | talo | aurinko ja kaari | talo, runko sävytetty | talo |
| Tuotokset | lokero, jossa sivu | kerrokset | lokero sävytetty | maapallo |
| Oma selain | selainikkuna | osoitin | otsikkopalkki sävytetty | maapallo |
| Agentin käytössä | pistoke | napa | pistokkeen runko sävytetty | kilpi ja ! |
| Selitä | ? ympyrässä | ? puhekuplassa | ? ympyrässä | (vain valikossa) |
| Haku, Uusi keskustelu, Uusi työtila, Asetukset | tuotannon | tuotannon | tuotannon (viivana) | tuotannon |

Erottuvuus mitattiin näin: kuvakerivin viisi kuvaketta rasteroidaan 18 px
kokoon 1x-tiheydellä, ja jokaiselle parille lasketaan, kuinka paljon kuvat
menevät päällekkäin (100 % = sama kuva). Tarkistus epäonnistuu, jos jokin
pari ylittää 50 %.

| Suunta | Lähin pari | Päällekkäin |
| --- | --- | --- |
| A Esineet | Agentin käytössä ja Haku | 35 % |
| B Merkitykset | Tuotokset ja Oma selain | 25 % |
| C Kaksisävy | Etusivu ja Tuotokset | 43 % |
| Nyt | Tuotokset ja Oma selain | 100 % |

Luku mittaa vain kuvien päällekkäisyyttä, ei sitä, kuinka helposti
merkityksen tunnistaa. B:n hyvä luku tulee siitä, että sen muodot ovat
keskenään hyvin erilaisia, ei siitä, että ne olisivat selkeämpiä.

## Tilamerkit

Tilamerkit ovat kaikissa suunnissa samat. Ne jatkavat `rail-space-2`:n
merkintää, eikä mikään niistä ole pelkkä väri:

- **Luku** (Tuotokset, uudet): korostusvärinen pilleri kuvakkeen
  oikeassa yläkulmassa. Ruudussa luku on sanana toisella rivillä (*1 uusi*)
  ja rivillä pillerinä oikeassa reunassa.
- **Agentti työssä** (Oma selain): ok-värinen piste kuvakkeen oikeassa
  alakulmassa. Piste sykkii, paitsi kun käyttäjä on pyytänyt vähemmän
  liikettä. Ruudussa ja rivillä on sana *Agentti työssä*.
- **Odottaa sinua** (Oma selain; Agentin käytössä, kun yhteys odottaa
  kirjautumista): Sinun vuorosi -värinen piste, ja itse kuvake vaihtaa
  samaan väriin. Ruudussa ja rivillä on sana.
- **Selitä päällä**: painike on painettuna korostuspinnalla.
- **Nykyinen paikka**: tuotannon nykyisen rivin pinta ja reunaviiva.

Kuvakerivissä vihje ja saavutettava nimi kertovat saman, esimerkiksi
*Oma selain · odottaa sinua: vahvista kirjautuminen*.

## Mitä näkymä olettaa hostilta

Ei mitään uutta. Uusien tuotosten määrä, selaimen tila (valmiina / agentti
työssä / odottaa sinua) ja keskustelurivit ovat jo tuotannon tietoja.
Agentin käytössä -tila *yhteys odottaa kirjautumista* on uusi esitys. Sen
tieto on jo olemassa (GitHub-yhteyden ilmoitus, `statusItems`), mutta
sivupalkki ei näytä sitä nyt.

## Decisions for later review

- **Agentin käytössä on pistoke eikä avain tai kilpi.** Vaihtoehdot olivat
  avain (*sinun tunnuksesi*), kilpi ilman huutomerkkiä ja napa (B). Valitsin
  pistokkeen, koska sivu luettelee yhteyksiä ja sen painike on *Yhdistä
  palvelu*. Avain on tuotannossa jo täyden oikeuden merkki samalla sivulla,
  joten se olisi saanut kaksi merkitystä.
- **Tuotokset on lokero, jossa on sivu, eikä lähtevä laatikko.** Tuotokset
  sisältää myös vain sinulle annettuja näkymiä. Ylös osoittava nuoli
  (`rail-space-2`) ja maapallo (*julkinen*) kertoisivat vain jaetuista.
- **Selitä sai oman kuvakkeen sivupalkin hyllyyn** henkilövalikon viereen,
  ja se on yhä myös valikossa. Vaihtoehto oli pitää se vain valikossa, kuten
  nyt. Brief pyysi Selitälle kuvaketta, ja ui-structure-2:n paikkarivissä
  sillä oli jo oma painike.
- **Agentin käytössä näyttää odottaa sinua -tilan**, kun jokin yhteys tarvitsee
  kirjautumisen. Vaihtoehto oli jättää se tilarivin kellon varaan. Valitsin
  näin, koska se on sama "sinun vuorosi" -tieto kuin selaimen pyynnössä.
- **Haku, Uusi keskustelu, Uusi työtila ja Asetukset pidettiin tuotannon
  kuvakkeina** kaikissa suunnissa. Ne ovat työkaluja, eivät paikkoja, eikä
  niistä ole ollut sekaannusta.

## Questions for Jari

1. Kelpaako A Esineet, vai haluatko C:n sävytyksen paikoille, jotta ne
   erottuvat työkaluista?
2. Pistoke Agentin käytössä -paikalle: kertooko se sinulle *mitä agentti saa
   käyttää*, vai sopisiko avain (sinun tunnuksesi) paremmin, vaikka se on
   jo täyden oikeuden merkki samalla sivulla?
3. Saako Selitä oman kuvakkeen sivupalkkiin, vai pysyykö se vain
   henkilövalikossa?
