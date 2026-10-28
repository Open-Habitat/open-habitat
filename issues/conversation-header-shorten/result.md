# Tulos: keskustelun otsake yhdellä rivillä

Toteutettu speksin mukaan (proto-conversation-header, kierros 2, suunta 1
*Taso avattaessa*, nimi `Opus 5.5`). Työpöydän otsake on yksi rivi.
Kun tila loppuu, sirut lyhenevät paikallaan prototyypin järjestyksessä, kunnes
otsikolla on 40 % rivistä tai koko tekstinsä. Järjestys: työtila → kontekstin
prosentti (rengas jää) → Uusi otsikko, Arkistoi ja Tiedot ⋯-valikkoon →
tiedostomäärä → tiiviimmät välit ja 6 px:n sirusisennys → Git-luvut (ikoni
jää, valikkoon Git-rivi) → malli (valikkoon Malli-rivi). Kahden rivin container
query on poistettu.

Kevyt ulkoasu: Git-, malli- ja kontekstisiruilla ei ole reunaa eikä taustaa
(tausta näkyy osoittimen alla ja avattuna). Git-sirussa on ikoni ja nollasta
poikkeavat luvut, ei haaran nimeä. Mallisirussa on vain lyhyt nimi, ja
ajattelutaso on sirun vihjeessä, saavutettavassa nimessä ja avautuvassa
tasossa. Toiminnan tila on piste. Sen vihje näkyy osoittimen alla,
näppäimistöfokuksella ja napautuksella (työskennellessä esimerkiksi
`Työskentelee · Ajattelee · 2 min 14 s`), ja sama teksti on pisteen nimi.
Puhelimen asettelu on ennallaan, ja siinä ovat samat lyhyet sirut.

Kuvat (laitteen skaalaus 2) ovat hakemistossa `evidence/`: työpöytä
1024/1280/1920 sivupalkki auki, 1024/1600 editori auki, pisteen vihje
näppäimistöfokuksella sekä puhelin 390 px, vaalea ja tumma.
Testidatassa on tarkoituksella pitkä otsikko, pitkä haara ja pitkä mallinimi
(`Opus 5.5 Extended Preview`). Siksi 1024 px:ssä sivupalkki auki myös Git-luvut
ovat piilossa. Tavallisella mallinimellä ne mahtuvat.

## Rakenne

- `web/src/components/HeaderShortening.tsx`: `useHeaderShortening` mittaa
  rivin (ResizeObserver ja MutationObserver) ja kokeilee vaiheita
  järjestyksessä. Tulos menee rivin `data-shorten`-listaan, ja
  `components.css` piirtää vaiheet siitä. Mittaus tarvitaan, koska sisältö
  (otsikon pituus, Git-luvut, Opas-painike, editorin navigointi) vaikuttaa
  yhtä paljon kuin leveys. `HeaderActivity` on pisteen painike ja vihje.
- `ModelChip compact` on otsakkeen siru. Kentän `ComposerModelPicker` näyttää
  tason ennallaan.
- `GitStatusChip` ei näytä haaraa eikä nollia. `data-menu-summary`
  (`main ↑3 ●2`) on ⋯-valikon Git-rivin teksti.
- Seuraava issue (`archive-notice-header-row`) voi lisätä ilmoitusrivin
  otsakkeeseen `ah-agent-topline`n jälkeen. Mikään sääntö ei oleta, että
  topline on otsakkeen ainoa rivi.

## Päätökset myöhempää tarkistusta varten

- **Otsikon latauspisteet vievät tilaa vain nimettäessä.** Ennen kolmelle
  pisteelle varattiin aina 29 px otsikon perästä. Editorin vieressä
  (sarake 440 px) otsikkotekstille jäi siksi 132 px, kun 40 % on 155 px.
  Nyt pisteet vievät tilaa vain nimen luonnin ajan: lyhennetyn otsikon
  katkaisukohta siirtyy silloin hetkeksi vasemmalle. Työkalut eivät siirry,
  koska otsikkorivi täyttää aina jäljelle jäävän tilan. Vaihtoehdot:
  (a) mitataan otsikko pisteineen, jolloin teksti jää 34 %:iin, tai
  (b) lisätään kahdeksas vaihe, joka siirtää editorin navigointipainikkeen
  (☰) valikkoon. Prototyypissä tätä painiketta ei ollut, ja siksi siellä
  tilaa riitti.
- **⋯-valikon painike on hiljainen ⋯-ikoni** sekä työpöydällä että
  puhelimessa (uusi `more`-ikoni). Aiemmin se oli reunallinen painike ja
  alaspäin osoittava kulma. Vaihtoehto: kulma säilyy puhelimessa. Valitsin
  yhden ilmeen, koska painike on sama komponentti ja kuuluu kevyeen
  ulkoasuun.
- **Valikon Git-rivi avaa Git-sirun tason.** Siru näkyy yhä ikonina. **Malli-rivi
  avaa Tiedot** (malli ja ajattelutaso), koska mallisiru on tässä vaiheessa
  piilossa eikä sen tasoa voi ankkuroida. Vaihtoehto: pelkät tietorivit ilman
  toimintoa.
- **Mallisirun saavutettava nimi on `Opus 5.5 · ajattelutaso Medium`**, ilman
  aiempaa etuliitettä „Malli ja ajattelutaso:“. `AgentHeader`n varasiru
  (historia, worktree-ajot) lisää perään „· avaa tiedot“.
- **Vaihe ja kesto ovat vihjeessä vain työskennellessä.** Muissa tiloissa
  (`Odottaa sinua`, `Lepää`) vihje on pelkkä tila. Kesto käyttää
  vaiheriviltä tuttua muotoa `2 min 14 s`.
- **Pisteellä ei ole `aria-expanded`-tilaa.** Vihje toistaa pisteen nimen
  (`aria-hidden`), joten ruudunlukijalle avautuvaa sisältöä ei ole.
- **Taustatyön odotus (`Odottaa taustatyötä`) ja Vain luku pysyvät
  tekstinä.** Ensimmäinen on toiminto, joka avaa odotetun prosessin, ja
  jälkimmäinen on pysyvä tila. Speksi koski tavallista toiminnan tilaa.

## Tarkistus

- `lab-desktop-header.spec.ts` on kirjoitettu uudelleen. Se käy läpi
  leveydet 1024, 1280, 1600 ja 1920, sivupalkki auki ja editori auki, pitkällä
  otsikolla, haaralla ja mallinimellä. Se tarkistaa, että otsake on yksi rivi,
  ettei mikään mene päällekkäin tai rivin yli ja että otsikolla on vähintään
  40 % rivistä tai koko tekstinsä. Toiminnot on löydyttävä näkyvistä tai
  ⋯-valikosta, ja valikossa on oltava Git- ja Malli-rivi silloin, kun ne
  on piilotettu. Git-rivi avaa haaran nimeävän tason. Lisäksi testi
  tarkistaa sirujen sisällön, pisteen vihjeen osoittimella ja
  näppäimistöllä, axe-tarkistuksen vaaleana ja tummana ja sivun leveyden.
  Neljä testiä meni läpi.
- `lab-phone-header`: lyhyet sirut ja pisteen napautus. Napautus kuvattiin
  puhelinkuviin. Lisäksi päivitettiin `lab-git-status` (siru ilman haaraa ja
  nollia), `lab-picker-declutter` (otsakkeen siru ilman tasoa, taso
  vihjeessä) ja `queued-send` (valitsin).
- Nämä menivät läpi: `lab-desktop-header`, `lab-phone-header`,
  `lab-git-status`, `lab-picker-declutter`, `queued-send`,
  `title-regeneration`, `lab-model-menu` ja `context-ring`
  (`OH_PORT_BASE=5500`, 2 workeria). Myös `./scripts/test-focused.sh --area web`
  meni läpi (tyypit, lint, 842 yksikkö- ja komponenttitestiä). Koko
  selainsarja jäi kapellimestarille.
