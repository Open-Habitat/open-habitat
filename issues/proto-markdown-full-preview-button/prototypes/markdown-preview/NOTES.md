# Markdownin esikatselu · koko näkymän ohjain

Sanoit 28.10., että Cmd+Shift+V:n avaama esikatselu tekstin tilalle on
juuri oikea, että lukunäkymä saa olla muokkaamaton, että Cmd+K V on liian
hidas ja että koko näkymän esikatselulle tarvitaan oma painike. Tämä
kierros näyttää Habitatin oman editorin (CodeMirror 6) pitkän
Markdown-tiedoston kanssa. Valittavana on yksi asia: **minkä muotoinen
ohjain koko näkymän esikatselulla on.**

## Sama kaikissa suunnissa

- **⌘⇧V** (PC:llä Ctrl+Shift+V) vaihtaa tekstin ja koko näkymän
  esikatselun välillä, kuten nyt.
- **⌘⌥V** (PC:llä Ctrl+Alt+V) avaa ja sulkee esikatselun tekstin
  rinnalle. Se korvaa kaksivaiheisen Cmd+K V:n yhdellä painalluksella.
  CodeMirrorin näppäinkartoissa sitä ei ole, eikä Chrome, Safari tai
  Firefox tietääkseni käytä sitä omiin toimintoihinsa. Windowsissa
  AltGr lähettää Ctrl+Alt, joten AltGr+V jätetään rauhaan (ks.
  result.md).
- **Esc** palaa koko näkymän esikatselusta tekstiin. Esikatselu on vain
  luettava, joten Esc ei vie siltä mitään.
- **Sama kohta**: esikatselu avautuu siihen osioon, jota tekstissä
  katsoit, ja tekstiin palatessa teksti on siinä kohdassa, johon
  esikatselussa luit. Nyt tuotannossa esikatselu avautuu aina alusta.
- **Kapea paneeli** (puhelin tai keskustelu editorin rinnalla) ei näytä
  rinnakkaista. Siellä on vain teksti tai esikatselu, kuten nyt.
- **Kirjoittaminen** päivittää rinnakkaisen esikatselun, ja esikatselu
  pitää muokattavan kohdan näkyvissä.
- Pikanäppäin näkyy painikkeen vihjeessä, kun osoitin on painikkeen
  päällä tai painike saa näppäimistöfokuksen.

## Kolme suuntaa

| Suunta | Ohjain | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Painike | Työkalurivillä *Esikatselu* (silmä ja teksti) avaa koko näkymän. Sen vieressä on kuvake, joka avaa rinnakkaisen esikatselun. Painettu painike näyttää, kumpi on auki, ja uusi painallus sulkee sen. Kapeassa paneelissa kuvake jää pois. | Pienin muutos nykyiseen: nykyinen *Esikatselu* avaa jatkossa koko näkymän, ja rinnakkainen saa oman pienen kuvakkeen. Vie vähiten tilaa. | Rinnakkaisen kuvake ilman tekstiä täytyy oppia vihjeestä. |
| 2 Valitsin | Työkalurivillä yksi valitsin: *Teksti · Rinnakkain · Esikatselu*. Valittu tila näkyy aina. Kapeassa paneelissa *Teksti · Esikatselu*. | Tila näkyy yhdellä silmäyksellä, ja jokaiseen tilaan pääsee yhdellä painalluksella. Tekstiin paluulla on oma painike. | Vie työkaluriviltä eniten tilaa. Puhelimessa valitsin ja Tallenna joutuvat toiselle riville. |
| 3 Kelluva | Työkalurivillä ei ole esikatselua. Dokumentin oikeassa alakulmassa kelluu *Esikatselu*, joka vaihtuu esikatselussa *Muokkaa*-painikkeeksi. Leveässä paneelissa sen yllä on pieni rinnakkaisen kuvake. | Puhelimessa peukalon ulottuvilla, ja työkalurivi pysyy lyhyenä. Esikatselussa *Muokkaa* kertoo suoraan, miten tekstiin palataan. | Kelluva painike peittää tekstin kulman, ja se on uusi muoto editorissa. Koko editorissa ei ole muita kelluvia painikkeita. |

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-markdown-full-preview-button/prototypes/markdown-preview/index.html
```

Valitsin on sivun alareunassa (näppäimet 1–3 tai nuolet, kun fokus ei ole
tekstissä). Sivun ylärivillä valitaan teema ja puhelinkehys (390 px).
Vihreällä rivillä voit siirtää keskustelun editorin rinnalle, jolloin
paneeli kapenee, ja valita, näkyvätkö vihjeissä Macin vai PC:n näppäimet.

1. Vieritä teksti keskelle, esimerkiksi kohtaan *Majoitus*, ja paina
   ⌘⇧V. Esikatselu avautuu samaan osioon.
2. Vieritä esikatselussa eteenpäin ja paina Esc. Teksti on siinä
   kohdassa, johon luit.
3. Kokeile suunnan omaa painiketta ja ⌘⌥V-yhdistelmää. Kirjoita
   rinnakkaisessa tilassa tiedoston loppuun otsikko, esimerkiksi
   `## Paluukyyti`.
4. Valitse *Keskustelu: rinnalla* ja katso, mitä ohjaimesta jää jäljelle.
5. Katso sama puhelinkehyksessä.

Prototyyppi on synteettinen: tiedosto, keskustelu ja tallennus ovat
sivun omia, eikä sivu ota yhteyttä mihinkään. Tekstin korostus ja
otsikoiden ⌄-merkit jäljittelevät CodeMirroria. Kokoaminen ei toimi
prototyypissä.

## Kuvat

`evidence/`-hakemistossa on jokaisesta suunnasta kuvat työpöydältä
(1440 px) ja puhelimesta (390 px) vaaleana ja tummana:
`teksti` (tiedosto keskeltä), `koko-nakyma` (⌘⇧V), `painikkeella`
(suunnan oma ohjain), `rinnakkain` (⌘⌥V ja kirjoitus), `vihje`
(pikanäppäin painikkeen vihjeessä) ja `keskustelu-rinnalla` (kapea
paneeli).

## Suositus

**1 Painike.** Pyysit omaa painiketta koko näkymän esikatselulle, ja
tämä suunta antaa sen nykyiseen paikkaan ilman uutta muotoa: sama
*Esikatselu*, joka avaa nyt koko näkymän, ja rinnakkaiselle pieni kuvake
leveään paneeliin. Valitsin näyttää tilan selvimmin, mutta se vie
editorin tiiviiltä riviltä eniten tilaa ja puhelimessa yhden rivin
lisää. Kelluva on paras peukalolle, mutta se tuo editoriin uuden
kelluvan muodon, joka peittää tekstiä.

Valintaasi odottavat myös [result.md](../../result.md):n kohdan
*Decisions for later review* päätökset, erityisesti se, poistetaanko
Cmd+K V kokonaan.
