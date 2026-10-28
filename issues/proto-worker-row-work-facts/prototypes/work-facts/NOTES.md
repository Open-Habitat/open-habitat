# Workerin työ rivillä · Kierros 1

Avaa `index.html` selaimessa (offline, yksi tiedosto). Yläreunan valitsin
tai näppäimet 1–3 ja ←/→ vaihtavat suuntaa. *Tilanne*-valikko vaihtaa sen,
mitä host tietää, ja *Worker etenee* tekee CSV-workerille uuden commitin.
Kuvat ovat hakemistossa `evidence/`.

Kierros on konduktorin oma, ja se perustuu workmux-tutkimuksen ideaan 5:
rivi kertoo jo ennen avaamista, onko worker saanut aikaan jotain. Tällä
hetkellä Workerit-paneelin rivi kertoo vain tilan (esim. *agentti odottaa*
tai *ei mergetty · työ tallessa*). Se ei kerro, onko haarassa yhtään
committia tai onko PR:n testit menneet läpi.

## Mitä katsoa

- **Workerit-paneeli** Iltakierros-keskustelussa (aukeaa valmiiksi).
  Kolme käynnissä olevaa workeria: yksi on tehnyt työtä, toisella on
  luonnos-PR ja testit kesken, ja kolmas ei ole vielä muuttanut mitään.
  Lisäksi kolme päättynyttä: mergeämätön, jonka main on ohittanut, epäonnistunut,
  jonka PR:n e2e-testi kaatui, ja laskeutunut.
- **Sivupalkki**: worktree-keskustelu *Galleria: nipistyszoomi* kertoo
  saman asian samassa muodossa. *Hakemiston siivous* on yhdistetty, joten
  siinä ei ole lukuja.
- **Workerin näkymä**: paina riviä, esimerkiksi *Lomakkeen saavutettavuus*.
- **Tilanne › gh ei kirjautunut**: PR-tietoja ei ole. Paneelin yläreunassa
  on yksi huomautus, eikä yksikään rivi väitä, ettei PR:ää ole.
- **Tilanne › Git ei vastaa yhdelle**: CSV-workerin rivi sanoo *työn tila
  ei tiedossa*, mikä erottuu selvästi tilanteesta *ei vielä muutoksia*.
- **Worker etenee**: luvut muuttuvat, mutta rivin korkeus pysyy samana.

## Mitä kierros vertailee: missä muodossa rivi kertoo työn

| Suunta | Mitä rivillä on | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Lause | Sanat rivin toisella rivillä heti tilan jälkeen: *2 committia · 3 muutosta*, *PR #412 luonnos tarkistukset käynnissä*, *ei vielä muutoksia*. Workerin näkymän yläosassa on sama koko lauseena ja linkki PR:ään. | Paneeli pysyy kaksirivisenä eikä tarvitse selitettä, kuten sovit Rivi-kierroksella 27.10. Ei uusia merkkejä opeteltavaksi. | Rivin toinen rivi täyttyy. Puhelimessa se rivittyy kolmelle riville. PR ei ole rivillä linkki, koska koko rivi on yksi painike, joten PR avataan workerin näkymästä. |
| 2 Luvut | Yläpalkin Git-sirun merkit rivin oikeassa reunassa: ↑ commitit, ↓ kuinka paljon main on edennyt, ● muutokset, +/− rivit ja PR-merkki (✓, ✗ tai pyörivä). Nollia ei näytetä. Workerin näkymässä on sama siru, ja siitä aukeaa taso, jossa on tiedostot ja tarkistukset. | Tiivein. Sama kieli kuin yläpalkin Git-sirussa, ja PR on oma painikkeensa. | Merkit pitää osata lukea. Puhelimessa ↓ ja PR:n numero jäävät pois, ja rivin nimi lyhenee. Kun mitään ei ole tehty, rivi on tyhjä: se tarkoittaa *ei vielä mitään*, mutta sitä ei sanota. |
| 3 Työrivi | Oma kolmas rivi: viiden ruudun diff-palkki, +/− rivit, *2 committia · 3 muutosta · main edennyt 5* ja PR-pilleri, jossa on tarkistukset laskettuina (*1/4 epäonnistui*). Workerin näkymän alussa on Työ-kortti, jossa on tiedostot ja jokainen tarkistus. | Selkein: kaikki näkyy kerralla, ja epäonnistunut tarkistus erottuu punaisena. | Jokainen rivi on noin kolmanneksen korkeampi, joten paneeliin mahtuu vähemmän workereita. Sivupalkkiin mahtuu vain palkki, rivit ja PR:n merkki. |

## Mitä on sama kaikissa

- Sama data ja sama ruudunlukijan lause joka suunnassa, esimerkiksi
  *2 committia haarassa, 3 tiedostoa commitoimatta. 146 riviä lisätty ja
  12 poistettu. Ei pull requestia.*
- Vertailukohta on workerin lähtöhaara (yleensä main), ei seurantahaara,
  koska worker-haaralla ei ole sellaista.
- Laskeutuneen workerin rivillä ei ole lukuja, koska sen työ on jo mainissa.
- Tieto, jota ei ole, ei näy nollana. Jos gh ei ole kirjautunut, PR-tieto
  puuttuu, eikä rivi silloin väitä, ettei PR:ää ole.

## Mitä tarvitaan hostilta

Muutokset ja ahead/behind tarvitaan joka suunnassa. Ne ovat jo olemassa
worktree-keskusteluille, mutta eivät Taskfleetin workereille. Daemonin
pitäisi lukea workerin worktree samalla tavalla kuin se lukee worktree-paikan.
PR ja tarkistukset vaativat, että daemon kysyy ne sinun omalla gh:llasi
(`gh pr list --head <haara>`). Se on sama valtuus kuin nyt, mutta jokainen
worker tarkoittaa yhtä verkkokutsua GitHubiin. Tarkat tiedostopolut ovat
issuen `result.md`:ssä.

## Suositus

**1 Lause** paneeliin ja sivupalkkiin. Workerin näkymään lisäisin suunnan 3
Työ-kortin, koska siellä on tilaa ja siellä päätetään, mitä työlle tehdään.
Lause noudattaa paneelin omaa periaatetta: toinen rivi kertoo sanoin, mitä
rivi tarkoittaa, eikä selitettä tarvita. Se myös kertoo ääneen tilanteen
*ei vielä muutoksia*, joka on juuri se, mitä tämä idea halusi nähdä.
Lisäksi tämä yhdistelmä tarvitsee rivejä varten vähiten uutta: +/− rivejä ei
tarvita paneelissa eikä sivupalkissa, vaan vasta workerin näkymässä.

## Kysymykset sinulle

1. Mikä suunta (tai yhdistelmä)?
2. Ovatko PR ja tarkistukset sen arvoisia, että daemon tekee sinun gh:llasi
   yhden GitHub-kutsun workeria kohden? Ilman niitä kaikki suunnat toimivat
   pelkillä Git-tiedoilla.
