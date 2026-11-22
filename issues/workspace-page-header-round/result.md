# Tulos: työtilan sivun yläosa, yksi kierros

Kierros `design-system/prototypes/rounds/2026-11-22-workspace-page-header/`
(rakennus ja tarkistus sen `NOTES.md`:ssä). Kolme suuntaa valitsimen takana,
yksi rivi kustakin sivun yläreunassa ja suositus niiden alla. Tuotannon
tokenit ja komponentit (`AppShell`, sivupalkki, `WorkspaceIcon`,
`WorkspaceIconPicker`, `SoundEmblem`, `ControlButton`), työpöytä ja puhelin,
Päivä, Yö ja Korkea kontrasti. Tuotantokoodi ei muuttunut.

Kuvat (DPR 2), ei repossa:

- nykytila labista: `/var/tmp/agent-keep/workspace-page-header-round/current/`
  (`current-1280-light.png`, `current-390-light.png` ja koko sivut);
- kierros: `/var/tmp/agent-keep/workspace-page-header-round/round/`
  (`v<n>-<suunta>-<tilanne>-<leveys>-<teema>.png`, `heights.json`).

## Lähtötilanne

Labissa (attention-sound päällä) yläosa on kaksi kerrosta: otsikko
(kuvake, nimi, polku ja kuusi ikonitoimintoa) ja sen alla nauha, jossa
on kolme 128 px:n laattaa. Kuvake ja nimi näkyvät kahdesti, puhelimessa
nimi kolmesti, kun mukaan lasketaan yläpalkki. Otsikkoalue vie
kuvakaappauksesta mitattuna noin 220 px työpöydällä ja noin 240 px
puhelimella ennen sivun sisältöä. Uusi keskustelu on nimetön plus-ikoni.

## Akseli ja suunnat

Akseli: **missä työtilan tunnistetiedot näkyvät ja muuttuvat.**
Sisältö on sama kaikissa suunnissa. Otsikkoalueen korkeus sisältöön
asti (`heights.json`):

| Suunta | Mitä se päättää | 1280 px | 390 px |
|---|---|---|---|
| **A Otsikko** | Otsikko on editori. Kuvake on tuotannon kuvakevalitsimen painike kynämerkkeineen, nimi muuttuu paikallaan otsikosta, kopiointi on polun vieressä ja Ääni on siru polun rivillä. Laatat poistuvat. | 74 | 150 |
| **B Asetusrivi** | Otsikko ja toiminnot ovat kuten nyt, ja otsikon kuvake on pelkkä kuva. Laattojen tilalla on yksi 40 px:n rivi kolmea nimettyä sirua (Kuvake, Nimi, Ääni). Nimi-siru muuttaa otsikon kentäksi. | 112 | 196 |
| **C Laatat** | Laatat ovat otsikko. Nimen laatassa on h1 ja polku kopiointeineen, ja Kuvake ja Ääni ovat sen vierellä. Toiminnot ovat laattojen alla: Uusi keskustelu ja Uusi worktree sanoin, arkistointi, GitHub ja poisto ikoneina oikealla. Puhelimessa Nimi on omalla rivillään ja Kuvake ja Ääni puolikkaina (64 px). | 174 | 232 |

Kaikissa suunnissa nimi on sivulla kerran (h1), ja nimi muokataan
paikallaan (Jarin 21.11. valinta B Paikallaan): Enter ja muualle klikkaus
tallentavat, Esc peruu ja tyhjä nimi palauttaa kansion nimen. Kuvake avaa
tuotannon editorin, ja valinta päivittyy otsikkoon ja sivupalkkiin.
Ääni avaa ponnahduksen, joka pysyy näkymän sisällä.

## Suositus: C Laatat

C pitää 21.11. valitut laatat, niiden nimetyt sanat ja paikallaan
muokattavan nimen, joten opittu paikka ei muutu. Kaksoisotsikko poistuu,
koska Nimen laatta on itse otsikko. Uusi keskustelu saa sanan, ja
harvinaiset siivoustoiminnot väistyvät oikealle. C on kolmesta korkein,
mutta silti noin 45 px matalampi kuin nykyinen yläosa.

A on matalin ja siistein. Siinä kuitenkin jokainen muutettava asia on
nimeämätön (kynämerkki, klikattava otsikko, siru), ja se on juuri se
löydettävyys, jota laatat korjasivat. B on kompromissi, joka jättää
kaksoisnäkymän (kuva otsikossa, sama kuva sirussa).

## Mitä näkymä olettaa hostilta

Ei mitään uutta. Samat tiedot kuin nyt: näyttönimi ja kansio, kuvakeketju
(`icon`, `icon_auto`, logo), ääniasetus, `git_summary.github_repo`,
`visibility` sekä toimintojen sallittuus (`mutation_state`, csrf).

## Decisions for later review

- **Uusi worktree näkyy C:ssä sanoin työpöydällä ja ikonina puhelimessa.**
  Vaihtoehdot olivat sana kummassakin (rivi ei mahdu 390 px:iin) tai ikoni
  kummassakin. Valitsin näin, koska työpöydällä on tilaa ja nimetty toiminto
  on selkeämpi; puhelimella sana katkaisisi rivin kahtia.
- **Kopioi polku siirtyi A:ssa ja C:ssä polun viereen** pois toimintoriviltä.
  Toinen vaihtoehto oli pitää se toimintorivillä. Valitsin näin, koska
  kopiointi koskee polkua, ja polun vieressä on selvää, mitä kopioidaan.
- **B:n Nimi-siru näyttää arvona "Kansion nimi" tai "Oma"** eikä nimeä
  uudestaan. Vaihtoehto oli nimi itse, mutta se toistaisi otsikon.
- **Äänen ponnahdus on kierroksessa lyhyt lista.** Tuotannon valitsin
  (kortit, ▶, Valmis) on päätetty eikä kuulu tähän akseliin, joten se
  pysyy ennallaan.
- **B:n sirut näyttävät puhelimessa vain ikonin ja arvon**, ilman sanaa.
  Vaihtoehto oli sana kahdella rivillä. Valitsin näin, koska tällä
  tavalla kolme sirua mahtuu kahdelle riville.

## Kysymykset Jarille

1. C vai A? Ratkaiseva kysymys on, painaako laattojen löydettävyys
   enemmän kuin otsikon matala korkeus.
2. Saako Uusi keskustelu C:n tapaan sanan myös silloin, kun valittu suunta
   on A tai B?
