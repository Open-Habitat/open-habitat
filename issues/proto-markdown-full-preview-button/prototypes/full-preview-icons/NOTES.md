# Koko näkymän esikatselu · kierros 2: ikonirivi ja muodot

Valitsit 28.10. ensimmäiseltä kierrokselta suunnan *Painike*: painikerivi,
mieluiten ikoneina, eikä rinnakkaista esikatselua. Halusit saman
esikatselun myös CSV:lle ja muille muodoille, joissa se on mielekäs. Tämä
kierros näyttää Habitatin oman editorin (CodeMirror 6) viidellä
tiedostolla. Valittavana on yksi asia: **missä ikonirivi on ja mitä
kuvakkeita siinä on.** Kierros 1 on yhä vertailtavissa:
[../markdown-preview/index.html](../markdown-preview/index.html).

## Sama kaikissa suunnissa

- **Esikatselu korvaa tekstin.** Rinnakkaista tilaa ei ole, joten
  Cmd+K V poistuu.
- **⌘E** (PC:llä Ctrl+E) on uusi, nopeampi pikanäppäin: kaksi näppäintä
  yhdellä kädellä, ja E kuin *esikatselu*. Se vaihtaa tekstin ja
  esikatselun välillä. **⌘⇧V** toimii edelleen samoin kuin VS Codessa.
  **Esc** palaa esikatselusta tekstiin.
- **Samassa kohdassa:** Markdown avautuu siihen osioon, jota tekstissä
  katsoit, ja CSV samalle riville. Tekstiin palatessa olet siinä
  kohdassa, johon esikatselussa luit.
- **Muodon mukaan:**

| Tiedosto | Esikatselu | Kuvake |
| --- | --- | --- |
| Markdown (`.md`) | Muotoiltu teksti, kuten nyt | silmä |
| CSV ja TSV | Koko tiedosto taulukkona. Otsikkorivi pysyy paikallaan, ja rivinumerot vastaavat tekstin rivejä. | taulukko |
| SVG | Kuva ruudukkotaustalla, jolloin läpinäkyvyys näkyy myös tummassa teemassa | kuva |
| HTML | Sivu ilman skriptejä ja verkkoa. Linkit eivät avaudu, ja yläreunan rivi kertoo sen. | silmä |
| JSON, YAML ja koodi | Ei esikatselua. Riviä ei näytetä, eivätkä näppäimet tee mitään. | – |

Kuvia (PNG, JPEG), PDF:ää ja Office-tiedostoja editori ei avaa lainkaan,
koska ne eivät ole tekstiä. Niiden katselu olisi oma ominaisuutensa
(ks. [result.md](../../result.md)).

## Kolme suuntaa

| Suunta | Missä | Kuvakkeet | Vahvuus | Hinta |
| --- | --- | --- | --- | --- |
| 1 Tiedostorivi | Työkalurivillä tiedostonimen ja Tallennan välissä, nykyisen *Esikatselu*-painikkeen paikalla | Pari: kynä (teksti) ja muodon kuvake. Auki oleva näkyy painettuna. | Molemmat tilat ja muoto näkyvät aina, ja paluu tekstiin on oma painikkeensa. Paikka on sama kuin nyt. | Puhelimessa työkalurivi on jo täynnä, ja tiedostonimi rivittyy. |
| 2 Otsikkopalkki | Editorin otsikkopalkissa ikkunapainikkeiden (‹ ×) vieressä, kuten VS Coden esikatselukuvake | Yksi kuvake, muodon mukaan silmä, taulukko tai kuva. Painettuna esikatselu on auki, ja uusi painallus palaa tekstiin. | Vie vähiten tilaa, eikä työkalurivi muutu. Tilaa on puhelimessakin. | Paluu tekstiin on saman kuvakkeen painallus, ja kuvake on kauempana tiedostosta, jota se koskee. |
| 3 Kulma | Kelluu dokumentin oikeassa yläkulmassa. Puhelimessa se on oikeassa alakulmassa peukalon ulottuvilla. | Pari kuten suunnassa 1 | Dokumentin luona ja puhelimessa helposti peukalolla. Työkalurivi pysyy ennallaan. | Peittää rivien loppua ja tuo editoriin kelluvan muodon, jota siinä ei muuten ole. |

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-markdown-full-preview-button/prototypes/full-preview-icons/index.html
```

Valitsin on sivun alareunassa (näppäimet 1–3 tai nuolet, kun fokus ei
ole tekstissä). Vihreältä riviltä valitaan tiedosto, keskustelu rinnalle,
Macin tai PC:n näppäimet, teema ja puhelinkehys (390 px).

1. Vieritä Markdown keskelle, esimerkiksi kohtaan *Majoitus*, klikkaa
   tekstiä ja paina ⌘E. Vieritä esikatselussa eteenpäin ja paina Esc.
2. Kokeile suunnan omaa ikonia ja katso vihjettä, kun osoitin on sen
   päällä.
3. Vaihda tiedostoksi `ilmoittautuneet.csv`, vieritä keskelle ja paina
   ⌘E. Kokeile samaa tiedostoilla `reittikartta.svg` ja `kutsu.html`.
4. Vaihda tiedostoksi `asetukset.json`. Riviä ei ole, eikä ⌘E tee
   mitään.
5. Katso sama puhelinkehyksessä ja keskustelu rinnalla.

Prototyyppi on synteettinen: tiedostot, keskustelu ja tallennus ovat
sivun omia, eikä sivu ota yhteyttä mihinkään. Korostus ja ⌄-merkit
jäljittelevät CodeMirroria.

## Kuvat

Kansiossa `evidence/` on kuvat jokaisesta suunnasta. Työpöytäkuvat ovat
1440 px:n ja puhelinkuvat 390 px:n levyisiä:

- `md-teksti`: Markdown keskeltä.
- `md-esikatselu`: ⌘E:n jälkeen, myös tummana.
- `csv-taulukko`: CSV taulukkona, puhelimessa tummana.
- `vihje`: ikonin vihje ja pikanäppäin.
- `keskustelu-rinnalla`: kapea paneeli.

Lisäksi `muoto-svg`, `muoto-html` ja `muoto-json` näyttävät muut muodot
suunnassa 1.

## Suositus

**1 Tiedostorivi.** Pari näyttää aina, kumpi tila on auki, ja
kynäpainikkeella on selvä paluu tekstiin myös puhelimessa, jossa Esc:iä
ei ole. Painikkeet ovat siellä, missä *Esikatselu* on nytkin, eli
tiedoston vieressä. Otsikkopalkki on siistein, mutta yksittäinen
painettu kuvake ei kerro yhtä selvästi, miten tekstiin palataan, ja
editorin otsikkopalkissa ovat muuten vain ikkunan toiminnot. Kulma on
paras peukalolle, mutta se peittää tekstiä, ja kierroksella 1
valitsit painikkeen kelluvan sijaan.

Päätöksiä, jotka odottavat katsomistasi, on [result.md](../../result.md):n
kohdassa *Decisions for later review*. Tärkeimmät ovat ⌘E ja HTML:n
esikatselu ilman skriptejä.
