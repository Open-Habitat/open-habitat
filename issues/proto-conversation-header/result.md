# Tulos: keskustelun otsake, kierros 2

Kierroksella 1 Jari valitsi suunnan 1 *Lyhenee* ja kaikille suunnille
yhteisen kevyen ulkoasun. Kierros 2 kokeilee hänen lisäpalautettaan
(2026-10-28 11:09): lyhyttä mallisirua, ajattelutason paikkaa ja Git-sirua
ilman haaran nimeä.

Prototyyppi on `prototypes/conversation-header-2/index.html`, yksi
offline-HTML. Se on käsin kirjoitettu sivu
(`design-system/prototypes/rounds/2026-10-28-keskustelun-otsake-2/page.html`),
jonka `build.mjs` täydentää tokeneilla, upotetuilla fonteilla ja yhteisellä
valitsimella. Opas Jarille on `prototypes/conversation-header-2/NOTES.md`,
kuvat ovat `evidence/`-hakemistossa (laitteen skaalaus 2) ja mittaukset
tiedostossa `evidence/metrics.json`. Kierroksen 1 prototyyppi ja kuvat ovat
vertailua varten ennallaan hakemistossa `prototypes/conversation-header/`.

## Pohja (sama kaikissa)

Pohjana on kierroksen 1 Lyhenee yhteisellä kevyellä ulkoasulla. Otsake on
yksi rivi, ja sirut lyhenevät paikallaan, kunnes otsikolla on vähintään
40 % rivistä tai koko tekstinsä. Siruilla ei ole reunaviivaa eikä taustaa
(tausta näkyy vain osoittimen alla ja avattuna), ja Gitin nollat ovat
piilossa. Toiminnan tila on pelkkä piste ilman tekstiä.
Pisteen vihje (`Työskentelee · Ajattelee · 2 min 14 s`) näkyy, kun osoitin
on pisteen päällä, kun piste saa näppäimistöfokuksen tai kun pistettä
napautetaan. Sama teksti on pisteen saavutettava nimi.

Kierroksen 2 muutokset pohjaan:

- **Git-siru ilman haaran nimeä.** Sirussa ovat haaran ikoni ja nollasta
  poikkeavat luvut (`↑3 ●2`). Kun kaikki luvut ovat nollia, siru on pelkkä
  ikoni. Haaran koko nimi on avautuvan tason otsikossa (tuotannon
  `GitStatusDetails` sellaisenaan: polku, seurantahaara, pohjahaara,
  commitit ja muutokset) sekä sirun saavutettavassa nimessä.
- **Mallisiru lyhyeksi.** Sirussa lukee `Opus 5.5` tai `Opus`.
  Prototyypissä pituuden voi vaihtaa yläpalkista kummassakin suunnassa.
  Avautuva taso on tuotannon `ConversationModelDetails`: mallit, käytössä
  olevan mallin tunniste ja ajattelutasot.
- **Lyhenemisjärjestys uusittu.** Kierroksen 1 vaiheet ajattelutason
  tekstille, aktiviteetin tekstille, haaran nimelle ja mallin nimen
  katkaisulle poistuvat, koska näitä tekstejä ei enää ole. Uusi järjestys:
  työtila → kontekstin prosentti (rengas jää) → Uusi otsikko, Arkistoi ja
  Tiedot ⋯-valikkoon → tiedostomäärä → tiiviimmät välit ja sirujen
  sisennys → Git-luvut (ikoni jää) → tasomittari (suunta 2) → malli
  ⋯-valikkoon.

## Akseli: missä ajattelutaso näkyy

| # | Suunta | Siru | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Taso avattaessa** | `Opus 5.5` | Ajattelutaso asetetaan keskustelun alussa eikä sitä tarvitse nähdä joka hetki. | Tason näkee vain vihjeestä tai avaamalla. Kahden keskustelun eri tasoja ei erota vilkaisulla. |
| 2 | **Tasomittari sirussa** | `Opus 5.5 ▂▄▆█` | Jos taso halutaan nähdä vilkaisulla. | Noin 21 px lisää ja uusi merkki, joka pitää oppia. Mittarissa on neljä palkkia seitsemälle tasolle (off 0, minimal ja low 1, medium 2, high 3, xhigh ja max 4), joten minimalia ja lowta tai xhighta ja maxia ei erota toisistaan ilman vihjettä. |

Mallin nimen pituus on toinen, riippumaton valinta: `Opus` säästää noin
21 px verrattuna nimeen `Opus 5.5`.

Mitatut sirujen leveydet: Git-siru pitkällä sisällöllä 80 px (kierros 1:
181 px, kun haaran nimi näkyi), Jarin kuvan sisällöllä 55 px ja puhtaalla
Gitillä 32 px. Mallisiru on suunnassa 1 70 px (`Opus 5.5`) tai 49 px
(`Opus`) ja suunnassa 2 91 tai 70 px. Kierroksella 1 se oli 142–158 px.

Otsikon leveys pitkällä otsikolla, sivupalkki auki (`metrics.json`; koko
otsikko on noin 650 px leveä):

| Sivupalkki auki | 1024 | 1280 | 1600 | 1920 |
|---|---|---|---|---|
| 1 Taso avattaessa, `Opus 5.5` | 336 (vaihe 5) | 405 (vaihe 1) | 548 (kaikki näkyy) | 868 (koko) |
| 1 Taso avattaessa, `Opus` | 276 (vaihe 3) | 426 (1) | 569 (0) | 889 (koko) |
| 2 Tasomittari, `Opus 5.5` | 316 (5) | 385 (1) | 528 (0) | 848 (koko) |
| 2 Tasomittari, `Opus` | 337 (5) | 406 (1) | 549 (0) | 869 (koko) |
| Kierros 1 Lyhenee | 314 (vaihe 10/12) | 425 (7/12) | 568 (5/12) | 888 (5/12) |

Otsikko saa suunnilleen saman tilan kuin kierroksella 1, mutta riville
mahtuu enemmän tietoa. Esimerkiksi 1280 px:ssä sivupalkki auki
kierroksella 1 haaran nimi, ajattelutaso ja kontekstin prosentti olivat
poissa ja malli katkaistu. Kierroksella 2 vain työtila on poissa. Jarin
kuvan sisällöllä 1280 px:ssä kaikki näkyy, myös työtila.

Editorin vieressä (keskustelusarake 440 px) otsikolle jää 163 px
(1920:ssa 210 px), ja malli siirtyy kaikissa suunnissa ⋯-valikkoon, kuten
kierroksella 1. Lyhennetty mallisiru ei riitä pitämään mallia rivillä, kun
otsikolla on oltava 40 % rivistä.

## Host-tiedot, joita suunnat tarvitsevat

Kumpikaan suunta ei tarvitse daemonin, gatewayn, provisionin tai
sopimuksen (`contracts/v1/`) muutosta. Kaikki näytettävä tieto on jo
selaimessa.

| Tieto tai rakenne | Onko olemassa |
|---|---|
| Lyhyt mallinimi `Opus 5.5` | **On**: `modelDisplayName` (`web/src/components/modelPresentation.ts`) poistaa jo alun `Claude`n ja lopun `1M`n. Kierroksen 1 synteettinen `Opus 5.5 (1M konteksti)` oli siis pidempi kuin tuotannon siru. |
| Mallinimi `Opus` (vain perhe) | **Ei ole.** Sen tekisi uusi apufunktio, joka ottaa näyttönimen ensimmäisen sanan. GPT-malleilla `modelDisplayName` antaa `GPT 5.5`, jolloin pelkkä `GPT` ei kerro mallia. |
| Ajattelutaso avautuvassa tasossa | **On**: `ConversationModelDetails` (`web/src/components/ConversationModelDetails.tsx`), joka avataan otsakkeen `details.md-chip-picker`-elementistä (`web/src/app/BrowserConversation.tsx`). Tyhjässä keskustelussa otsakkeen `ModelChip` on eloton, mutta kentän `ComposerModelPicker` näyttää ja valitsee tason, joten taso näkyy silloinkin. |
| Ajattelutaso vihjeessä ja saavutettavassa nimessä | **Osittain.** Avattavalla sirulla on `aria-label` „Malli ja ajattelutaso: …, …“ (`BrowserConversation.tsx`). Vihje (`title`) ja tyhjän keskustelun elottoman sirun nimi puuttuvat. |
| Mallisiru ilman tasoa vain otsakkeessa | **Ei ole.** `ModelChip` (`web/src/components/ModelChip.tsx`) piirtää aina nimen, ikonin ja tason, ja samaa komponenttia käyttää kentän `ComposerModelPicker`, jossa taso valitaan. Otsakkeelle tarvitaan oma esitys (esimerkiksi prop `compact`), jotta kentän valitsin säilyy ennallaan. Myös `AgentHeader`n varasiru (`settings`-propsi, `web/src/components/Navigation.tsx`) piirtää tason. |
| Tasomittari (suunta 2) | **Ei ole.** Uusi ikoni `Icon.tsx`:ään ja kartoitus tasolistasta (`ModelPicker.tsx`: off … max) palkkimäärään. |
| Git-siru ilman haaran nimeä | **On, esityksen muutos.** `GitStatusChip` (`web/src/components/GitStatus.tsx`) piirtää nimen omana `ah-gs-chip-branch`-elementtinään. Luvut ovat omina elementteinään (`.zero`-luokka nollille), ja saavutettava nimi (`gitSentence`) sisältää jo haaran. |
| Haaran nimi avattaessa | **On**: `GitStatusDetails`in otsikko (`ah-gs-branch`, rivittyy) ja polku. |
| Pisteen vihje tila ja kesto | **Osittain**, sama kuin kierroksella 1 sovittu: otsakkeella on `activityLabel` (`StatusMark`, `Navigation.tsx`). Vaihe („Ajattelee“) ja kesto (`elapsedLabel`) ovat `AgentTurn.tsx`:ssä, joten ne pitää välittää otsakkeelle. Valmista tooltip-komponenttia ei ole. Tämä kuuluu jo `conversation-header-shorten`-issueen. |

## Suositus

**1 Taso avattaessa ja nimi `Opus 5.5`.**

- Ajattelutaso on keskustelun asetus, jota vaihdetaan harvoin. Avattava
  taso näyttää sen ja kaikki vaihtoehdot. Lisäksi se on vihjeessä ja
  ruudunlukijan nimessä. Mittari on uusi merkki, joka on opeteltava, eikä
  se neljällä palkilla erota kaikkia seitsemää tasoa.
- `Opus 5.5` on tuotannon nykyinen näyttönimi, joten uutta
  nimeämissääntöä ei tarvita. Versio erottaa mallit, kun luettelossa on
  vanhempia saman perheen malleja, ja GPT-malleilla pelkkä perhe ei kerro
  mitään. `Opus` säästäisi vain 21 px. Suunnassa 1 se muuttaa
  näkyvää riviä ainoastaan 1024 px:n leveydellä sivupalkki auki: vaihe on
  3 eikä 5, joten tiedostomäärä jää näkyviin, mutta otsikko saa 60 px
  vähemmän.
- Suurin hyöty tulee Git-sirusta: pitkä haaranimi ei enää vie riviltä
  mitään, ja siru pysyy samanmittaisena haarasta riippumatta.

Jos Jari haluaa nähdä tason vilkaisulla, suunta 2 on toteutettavissa samalla
rakenteella. Lisätyötä ovat vain mittari-ikoni ja sen kartoitus.

## Muutokset toteutukseen

Suunnan 1 ja nimen `Opus 5.5` valinta muuttaa `conversation-header-shorten`-issueen
`item.md`:tä näin:

1. **Speksi**: kierroksen 2 prototyyppi
   (`prototypes/conversation-header-2/`, suunta 1) täydentää kierroksen 1
   suuntaa 1. Kierroksen 1 lyhenemisjärjestys korvataan kierroksen 2
   järjestyksellä (yllä, kohdassa Pohja).
2. **Mallisiru otsakkeessa**: vain mallin näyttönimi (`modelDisplayName`),
   ei ajattelutason ikonia eikä tekstiä. Taso näkyy avautuvassa tasossa
   (ennallaan), sirun vihjeessä ja saavutettavassa nimessä („Opus 5.5 ·
   ajattelutaso Medium“). Sama koskee `AgentHeader`n `settings`-varasirua ja
   tyhjän keskustelun elotonta sirua. Kentän `ComposerModelPicker` näyttää
   tason edelleen.
3. **Git-siru**: ei haaran nimeä. Sirussa ovat ikoni (haara, worktree tai
   yhdistetty) ja nollasta poikkeavat luvut. Kun kaikki on nollaa, siru on
   pelkkä ikoni. Saavutettava nimi ja avautuva taso pysyvät ennallaan.
4. **Lyhenemisen viimeiset vaiheet**: sirujen sivusisennys pienenee 6
   px:iin samassa vaiheessa kuin välit tiivistyvät, ja Git-luvut piiloutuvat
   ennen kuin malli siirtyy ⋯-valikkoon. Kun luvut ovat piilossa,
   ⋯-valikossa on Git-rivi (haara ja luvut).
5. **Puhelin**: asettelu pysyy ennallaan, mutta toisen rivin malli- ja
   Git-siru ovat samat lyhyet sirut, koska komponentit ovat yhteiset.

## Päätökset myöhempää tarkistusta varten

- **Puhelin saa samat lyhyet sirut.** Vaihtoehto: puhelimessa säilyvät
  haaran nimi ja taso. Valitsin lyhyet, koska sirut ovat yhteisiä
  komponentteja ja puhelimen toisella rivillä tila on vielä
  niukempi. `conversation-header-shorten`-issuen „puhelimen otsake
  ennallaan“ koskee asettelua.
- **Puhdas Git on pelkkä ikoni.** Vaihtoehdot: valintamerkki tai teksti
  „ajan tasalla“. Pelkkä ikoni on lyhin, ja tila selviää vihjeestä ja
  saavutettavasta nimestä. Valintamerkki olisi uusi merkki, jota tuotannossa
  ei ole.
- **Yhdistetyn worktreen sana „yhdistetty“ jää.** Sitä ei kokeiltu
  prototyypissä. Se on tila eikä nimi, ja se on lyhyt. Vaihtoehto on pelkkä
  yhdistämisikoni.
- **Pisteen osuma-alue on työpöydällä 20 px.** Vaihtoehto oli 24 px,
  mutta silloin otsikolle ei jäänyt 40 % rivistä editorin vieressä.
  Puhelimessa osuma-alue on 32 px.
- **Mittarin kartoitus (vain suunta 2).** Neljä palkkia ja seitsemän tasoa.
  Vaihtoehto: kuusi palkkia (minimal–max), mutta ne olisivat 14 px:n
  korkeudessa liian ohuita erottaa.
- **Kierroksen 1 vertailu** piirtää kierroksen 1 sellaisenaan, myös
  pidemmän mallinimen `Opus 5.5 (1M konteksti)`. Tuotannossa nimi olisi
  `Opus 5.5`.

## Kysymykset Jarille

1. Suunta 1 (taso avattaessa) vai 2 (tasomittari sirussa)?
2. `Opus 5.5` vai `Opus`?

## Tarkistus

`verify.mjs` rakentaa sivun ja käy läpi 109 tapausta: molemmat suunnat
kummallakin nimellä ja kierroksen 1 vertailun leveyksillä 1024, 1280, 1600
ja 1920, sivupalkki auki ja kiinni, editori auki, Jarin kuvan sisältö,
puhdas Git, vaalea ja tumma sekä puhelin 390 px. Lisäksi se kuvaa mittarin
tasoilla off, low, high ja max. Työpöydällä se varmistaa, että otsake on
yksi rivi, mikään ei mene päällekkäin tai yli ja otsikolla on vähintään 40 %
rivistä tai koko tekstinsä. Se varmistaa myös, että Git-sirussa ei ole
haaran nimeä, että mallisirussa on vain lyhyt nimi ja että mittari on
vain suunnassa 2. Se avaa malli- ja Git-tason (työpöytä, editori ja puhelin)
ja ⋯-valikon ja tarkistaa, että ne pysyvät sarakkeen sisällä. Pisteen
vihjeen se avaa osoittimella, näppäimistöfokuksella ja napautuksella. Lopuksi
se ajaa `picker-check`in ja vaatii, että konsoli ja verkko pysyvät puhtaina.
Ajo meni läpi. Tuotantokoodi ei muuttunut, joten selainsarjaa ja
Go-tarkistuksia ei ajettu.
