# Tilannekatsauksen asetukset

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on kirjoitettu
käsin eikä rakennettu tuotantokomponenteista. Lähde on
`design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset/`.
Tiedosto rakennetaan ja tarkistetaan komennolla
`node design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
AVIF-muodossa laitteen skaalauksella 2. Verify tarvitsee lisäksi ffmpeg:n.

## Mistä on kyse

Tilannekatsaus tulee nyt jokaiseen keskusteluun aina kolmen minuutin
hiljaisuuden jälkeen, ja malli valitaan säännöllä (Sonnet tai Luna, ei koskaan
Fable tai Opus). Mitään näistä et voi säätää. Tällä kierroksella näytetään,
mitä voisit säätää ja **missä**: Asetuksissa Tekoälyn alla, omassa
osiossaan vai suoraan kortista.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa ja vertailuna **Nykyinen**
  (tuotanto nyt). Näppäimet 1–4 ja nuolet vaihtavat suuntaa.
- **Näkymä**: Keskustelu tai Asetukset. Myös sivupalkin oma nimesi avaa
  Asetukset, ja keskustelun nimi palauttaa keskusteluun.
- **Hiljaisuus**: kuinka kauan keskustelu on ollut hiljaa (0, 1, 3 tai
  5 min). Tällä simuloidaan ajan kulumista.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Tumma tai Vaalea.
- Oikeassa yläkulmassa lukee asetuksen arvo, mitä keskustelussa sen
  perusteella näkyy, ja mitä palvelin osaa nyt.

## Mikä on kaikissa suunnissa samaa

Säädettävää on kolme asiaa:

- **Tilannekatsaus**:
  - **Automaattisesti**: kortti tulee itsestään, kuten nyt.
  - **Kun pyydän**: hiljaisuuden jälkeen kentän yläpuolelle tulee vain ohut
    rivi *Luo katsaus*. Mallia käytetään vasta, kun painat sitä.
  - **Ei koskaan**: mitään ei tule.
- **Hiljaisuus ennen katsausta**: 1, 3 tai 5 min. Pidempää ei ole, koska
  agentti lepää 10 minuutin kohdalla, eikä katsausta voi tehdä ilman sitä.
- **Malli**: suunnissa 1 ja 3 se näkyy (nyt Claude Sonnet 5.5), mutta sitä ei
  voi valita. Suunnassa 2 voit valita mallin. Fable ja Opus näkyvät luettelossa,
  mutta ne ovat harmaina, ja vieressä lukee "ei taustatöihin".

Asetus koskee kaikkia keskustelujasi kaikissa selaimissa, koska malli
kuluttaa tilaustasi riippumatta siitä, mistä selaimesta katsot.

## Suunnat (akseli: missä tilannekatsausta säädetään)

1. **Tekoälyn alla**: Asetukset › Tekoäly saa uuden *Taustatyöt*-kortin,
   jossa ovat Tilannekatsaus, Hiljaisuus ja Malli (näytetään, ei valita).
   Keskustelun kortti pysyy ennallaan.
2. **Oma osio**: Asetuksiin tulee oma kohta *Tilannekatsaus*. Siinä on
   kortin esikatselu sekä *Milloin*- ja *Malli*-kortit, joista malli
   valitaan luettelosta. Keskustelun kortissa on ratas, joka vie
   suoraan tähän kohtaan. Tekoäly-osiossa on rivi, joka kertoo
   taustatöiden mallin ja vie tänne.
3. **Kortista**: Asetuksissa ovat samat rivit kuin suunnassa 1, mutta
   pääasiassa säädät suoraan kortista. Kortin `⋯`-valikossa voit valita
   viiveen (1, 3 tai 5 min), *Vain kun pyydän* tai *Ei tilannekatsauksia*.
   Valikko kertoo myös mallin ja vie kaikkiin asetuksiin. Kun valitset
   *Vain kun pyydän* tai *Ei*, kortin paikalle tulee rivi, joka kertoo
   muutoksen koskevan kaikkia keskustelujasi. Rivillä ovat **Kumoa** ja
   **Asetukset**.

## Kokeile näin

1. Pidä **Keskustelu** ja **Hiljaisuus 3 min**, ja käy läpi Nykyinen, 1, 2
   ja 3. Kortti näyttää kaikissa samalta, mutta suunnassa 2 siinä on ratas
   ja suunnassa 3 `⋯`.
2. Suunta 3: avaa `⋯` ja valitse *Vain kun pyydän*. Kokeile Kumoa. Valitse
   sitten *5 min hiljaisuuden jälkeen* ja vaihda Hiljaisuus 3 min:iin, jolloin
   kortti ei vielä tule. Esc sulkee valikon.
3. Suunta 1: avaa **Asetukset** ja valitse *Kun pyydän*. Palaa keskusteluun
   sivupalkista: kortin tilalla on rivi *Luo katsaus*. Paina sitä.
4. Suunta 2: paina keskustelun kortin ratasta. Asetuksissa valitse malliksi
   GPT-6 Luna, niin esikatselu kertoo mallin. Yritä valita Fable: se ei
   onnistu.
5. Vaihda **Puhelin** ja **Vaalea**. Puhelimessa suunnan 3 valikko aukeaa
   kortin yläpuolelle koko leveydelle.

## Mitä sinun pitäisi päättää

- Mikä suunta (1, 2 vai 3)? Suosittelen suuntaa 3 (perustelu on tiedostossa
  `result.md`).
- Tarvitaanko kolmas tila *Kun pyydän*, vai riittävätkö Päällä ja Pois?
- Saako mallin valita itse (suunta 2), vai riittääkö, että näet sen?
- Tallennetaanko asetus Pi:n omaan `~/.pi/agent/settings.json`-tiedostoon
  omalla avaimellaan vai omaan tiedostoonsa Pi:n hakemistossa?
  Suosittelen ensimmäistä (`result.md`).
