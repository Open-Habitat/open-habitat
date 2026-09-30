# UI-pohjan arvio selainpolku v2:ta vasten

30.9.2026, lähderevisio `82a5c4e`. Tämä on issuen varsinainen arvio:
kuinka hyvin nykyinen UI toimii, kuinka kaukana komponentit ja yhteiset
rakenteet ovat designista ja mitä pitää tehdä yhteisesti ennen kuin näkymät
kannattaa sovittaa. [Ensiluku](first-read.md) kattaa designin sisällön ja
toiminnalliset poikkeamat, eikä niitä toisteta tässä.

## Johtopäätös

Pohja on toiminnallisesti ja semanttisesti vahva mutta visuaalisesti ohut.
Komponenttien rajat, tilasanasto, estosyyt, saavutettavuus, testit ja Storybook
ovat kunnossa, ja designin vaatimus "toiminta, rajapinnat ja tilakoneet pysyvät
ennallaan" on juuri sitä, mitä nykyinen jako sovelluskerroksen ja
komponenttien välillä tukee. Tyylikerros sen sijaan ei kanna designin
tarkkuutta: tokenit eivät sido komponentteja, sovelluskehys ei tunne
keskustelunäkymän rakennetta, painikkeen, tilamerkin ja ikonin kaltaiset
perusasiat on ratkaistu käyttöpaikka kerrallaan, ja sovelluskerros koostaa osan
näkymistä raakaelementeistä. Paikallinen hienosäätö ei tuota designin
"tarkka sijoittelu, helppo yhtenäinen muokkaus" -ominaisuutta, koska jokainen
näkymä pitäisi säätää erikseen ja sama säätö ei siirry muihin.

Suositus on yksi rajattu pohjatyö neljässä kohdassa ja vasta sen jälkeen
komponenttien ja näkymien sovitus:

1. tokenit leikataan designin mitoitukseen ja komponentit sidotaan niihin;
2. kehykseen lisätään näkymäpohjat (keskustelu, keskitetty sivu, onboarding);
3. painike, tilamerkki ja ikoni määritellään kerran variantteina;
4. tyylitiedosto jaetaan komponenteittain ilman ohituskerrosta.

Pohjatyön jälkeen komponenttien hienosäätö ja näkymien koostaminen ovat
suoraviivaisia ja jaettavissa rinnakkain. Ilman pohjatyötä sama sovitus on
mahdollinen, mutta se jäisi näkymäkohtaisten poikkeusten varaan ja designin
seuraava versio aloittaisi alusta.

## Mitä nykyinen UI tekee hyvin

Näiden varaan voi rakentaa, eikä niitä pidä ajaa uudelleen ulkoasun mukana.

- **Näyttömalli ja intentti.** Komponentit saavat valmiin näyttömallin ja
  palauttavat käyttäjän aikomuksen; verkko, kuitit, luonnokset ja
  istuntosidonta ovat `web/src/app/`-kerroksessa
  (`BrowserConversation.tsx`, `GitHubOnboarding.tsx`, `PiOnboarding.tsx`).
  Designin vaatima "säilytä tilanhallinta ja kilpatilanteiden käsittely"
  toteutuu, koska ulkoasu ei kosketa tätä kerrosta.
- **Saatavuus syineen.** `Availability`-tyyppi ja `Button`-primitiivin
  `ah-control-reason` tekevät estosyystä komponenttisopimuksen, ei
  näkymäkohtaista tekstiä. Designin "estetty painike ei haalistu, syy
  tekstinä vieressä" on tämän sopimuksen tyylikysymys.
- **Tila merkki + sana.** `StatusMark` ei koskaan näytä pelkkää väriä, ja
  `DesignSystem.test.tsx` vartioi sitä. Designin merkkisanasto (✓ ✕ ?
  sykkivä piste, ontto rengas) on saman komponentin varianttien lisäys.
- **Tokenit ja teemat.** `design-system/tokens/colors.css` on täsmälleen
  vedosten väripaletti; `theme.ts` vaihtaa `data-theme`-attribuutin ja
  Storybook ja lab käyttävät samaa polkua. Tummasta teemasta on olemassa
  näyttö ([dark-history](../extremely-impartial-spiders/dark-history.png)).
- **Testit kestävät ulkoasumuutoksen.** Playwright- ja komponenttitestit
  valitsevat elementit roolin ja nimen perusteella; `.ah-*`-luokkiin nojaa
  vain muutama kohta (`.ah-login-card`, `.ah-status-dot`,
  `App.tsx` fokuspalautus `.ah-account-shelf button`). Nimiä muuttavat
  kohdat (Lisätiedot → Tiedot, Keskeytä vuoro → Keskeytä) näkyvät testeissä
  ja korjataan samassa muutoksessa.
- **Näyttövälineet.** `web/lab/shoot.mjs`, `matrix.mjs` ja
  `session.mjs`:n `snapshot` tuottavat parillisen kuva + staattinen HTML
  -näytön synteettisestä labista, ja `design-system.spec.ts` ajaa Axen
  molemmissa teemoissa ja 200 %:n zoomin.

## Missä etäisyys syntyy

Kuvat [working-after](../complete-conversation-ui/working-after.png),
[reading-desktop](../complete-conversation-ui/reading-desktop.png),
[round4-after-home](../extremely-impartial-spiders/round4-after-home.png),
[round4-after-github](../extremely-impartial-spiders/round4-after-github.png)
ja [dark-settings](../extremely-impartial-spiders/dark-settings.png) ovat
synteettisen labin näyttöjä 29.–30.9. ja vastaavat yhä nykyistä CSS:ää.
Vertailukohta on `design/vedokset/`.

### A. Tokenit eivät ohjaa komponentteja (yhteinen)

`typography.css` määrittelee kahdeksan kokoa, mutta `components.css` käyttää
kirjaimellista fonttikokoa 24 kertaa ja tokenia 5 kertaa; kirjaimellisia
kokoja on 11 erilaista. Otsikot ovat kolmessa paikassa kolmella tavalla:
`app.css` `main h1` 30 px, `.ah-agent-header h1` `clamp(1.25rem, 2vw,
1.75rem)`, `.ah-reading-view .ah-agent-header h1` 1.25 rem. Designin
keskustelun otsikko on 15,5 px yhdellä rivillä ja sivun otsikko 21–22 px.
Kun typografia-asteikkoa muutetaan, muutos ei siirry näkymiin, ja juuri se
on ominaisuus, jota issue kysyy.

Välistys on paremmin sidottu (76 tokenkäyttöä, 30 kirjaimellista), mutta
asteikko 4/6/9/12/14/18/24/36 ei sisällä designin käyttämiä arvoja 8, 10, 13,
16, 22, 28 ja 56, joten sivupalkin ja rivien välit on kirjoitettu pikseleinä
(`padding: 11px 10px`, `padding: 8px 8px`, `gap: 2px`). Pyöristyksistä
puuttuu vain sivupalkin rivien 9 px.

Layout-mitat ovat hajallaan kirjaimellisina: sivupalkki 296 px
grid-määrittelyssä, suljettu 46 px kahdessa säännössä (design 52), keskitetty
sivu 720 px kolmessa säännössä, viestin mitta 70ch ja 76ch kahdessa, ja
keskustelun vierityskorkeus `60vh` inline-tyylinä
(`BrowserConversation.tsx`, `style={{ maxHeight: "60vh" }}`).

`production-v1.md` sanoo, että vedoksen yksittäiset mitat ovat
sommittelureferenssejä eivätkä tokeneita. Se kirjoitettiin v1-toimituksille.
V2-handoff ilmoittaa mitoituksen lopulliseksi ja käyttää vain nykyisiä
värejä, joten suosittelen kirjaamaan v2:n mitoitustaulukon tokenien lähteeksi
ja päivittämään tuon lauseen. Tämä on design systemin kaanonin muutos, joten
Jari voi torjua sen; ilman sitä jokainen mitta jää komponentin sisäiseksi
vakioksi.

### B. Sovelluskehys ei tunne näkymätyyppejä (yhteinen)

`AppShell` on yksi grid: `main` saa `clamp`-marginaalin ja `.ah-state`
keskittää 720 px:iin; `:has(.ah-rail)`-valitsin vaihtaa käytöksen, kun
sivupalkki on paikalla. Keskustelu on rakennettu tämän sisään
`.ah-reading-view`-osiona, jossa syöte vierittyy omassa `60vh`-laatikossaan
ja kirjoituskenttä on `position: sticky` osion sisällä. Design tarvitsee
kolme sivupohjaa, joita nyt ei ole:

1. **Keskustelu**: kiinteä yläpalkki (`--ah-surface`, alareuna `--ah-line`,
   pad 13 × 24), koko korkeuden vierityssarake (max 780 px), kiinteä
   kirjoituskehys ja kelluva *Viimeisimpään ↓*.
2. **Keskitetty sivu**: paluunäkymä 760 px / yläväli 56 ja asetukset 680 px
   / osioväli 28.
3. **Onboarding-kehys**: tuotenimi ja palvelin kortin yläpuolella,
   vaiheilmaisin kortissa, seuraava askel kortin alla, kortin leveys
   440/560/480.

Onboarding-kortti on nyt kolme erillistä toteutusta samasta asiasta:
`.ah-login-card` (pad 26, max 440), `GitHubRepoChooser.module.css .card`
(pad `--ah-s7` = 24, max 48 rem) ja `PiDeviceSignIn.module.css .card` (sama
kuin edellinen). Vaiheilmaisinta ei ole; kirjautumisen ja repovalinnan
näkymät eivät kerro, mille palvelimelle ollaan tulossa.

Puhelin: `@media (max-width: 800px)` pinoaa koko sivupalkin keskustelun
yläpuolelle ([round4-narrow-home](../extremely-impartial-spiders/round4-narrow-home.png)).
Design haluaa 316 px:n laatikon ja scrimin. Sekin on kehystyötä, mutta
toteutuslaajuus on Jarin päätös (ensiluvun avoin kysymys).

### C. Kolme primitiiviä puuttuu (yhteinen)

**Painike.** `.ah-button` on 44 px korkea, `compact` 36 px, ja
`components.css` sisältää 11 esi-isävalitsinta, jotka muokkaavat sitä
käyttöpaikan mukaan (`.ah-rail .ah-button-compact` 30 px,
`.ah-rail-filter .ah-button` 30 px leveä, `.ah-rail-refresh .ah-button`
11 px teksti, `.ah-account-shelf .ah-button`, `.ah-login-card .ah-button`).
Design tarvitsee kolme kokoa (työkalurivi 13,5 px pad 9 × 12, hiljainen
tekstipainike, 32 × 32 ikonipainike) ja avatar-painikkeen, ja ne kuuluvat
`Button`-propseiksi, ei ohituksiksi. Estetyn painikkeen `opacity: 0.65`
tekee tummassa teemassa *Päivitä*- ja *Tilivalikko*-painikkeista
lukukelvottomia, kuten handoff huomauttaa; designin ratkaisu (tausta
`--ah-line`, teksti `--ah-muted`) on yksi sääntö `Button`issa. Lisäksi
`Menu`- ja `Dialog`-komponenttien laukaisin on kovakoodattu
`ah-button-secondary`-painikkeeksi (`Overlays.tsx`), joten tilipainiketta
avatarilla tai suljetun kaistan `+`-valikkoa ei voi tehdä ilman
laukaisinpropsia.

**Tilamerkki.** `StatusMark`-piste on aina ontto rengas
(`border: 2px solid currentColor`), ja sivupalkin ohitukset täyttävät sen
`background: currentColor`. Design käyttää yhtä sanastoa kaikkialla:
täytetty sykkivä piste vain käynnissä olevalle, ontto rengas vain luvulle,
✓ ✕ ? -merkit, ja pilleri yläpalkissa ja paluunäkymässä. Tämä on yksi
`mark`-propsi ja yksi `pill`-esitystapa `Status.tsx`:ssä; nyt sama asia on
`StatusMark`, `Badge` ja kaksi CSS-ohitusta.

**Ikonit.** Ikonit ovat tekstimerkkejä (`‹ › ▾ ▸ ✓`), ja lisäksi nuolet
piirretään CSS-reunoilla (`.ah-menu-chevron`, `.ah-disclosure-chevron`).
Instrument Sans ei sisällä ⌂ ⧉ ↻ -merkkejä, joten ne tulevat
järjestelmäfontista ja näkyivät ensiluvun Playwright-ympäristössä
puuttuvan merkin ruutuina. Handoff sanoo "jos koodissa on ikonijärjestelmä,
käytä sitä". Suosittelen pientä inline-SVG-`Icon`-komponenttia, noin
kymmenen merkkiä (koti, valikko, nuolet, kopioi, ✓, ✕, ?, ↓, ↗, ↻, +),
`currentColor`-värillä ja `aria-hidden`. Se ei ole ikonikirjasto, ja se
poistaa fonttiriippuvuuden.

### D. Kaksi tyylimekanismia ja kasvava ohituskerros (yhteinen)

Yhteinen `components.css` (1 235 riviä, 247 sääntöä) ja kaksi CSS-moduulia
elävät rinnakkain. Tiedoston ensimmäinen rivi on
`biome-ignore-all noDescendingSpecificity`, koska sivupalkin ohitukset
ohittavat yhteiset tyylit tarkoituksella. Lukunäkymän viesti on ohitus
kortista: `.ah-reading-view .ah-feed .ah-message:not(.ah-message-alert)`
nollaa `.ah-message`in reunan, taustan ja täytteen ja vaihtaa sen
gridiksi. Suljettu sivupalkki piilottaa tekstin `font-size: 0`:lla.
Kaikki nämä toimivat, mutta ne ovat syy siihen, ettei yhteisen säännön
muutoksen vaikutusta voi ennustaa: sama viesti näyttää eri asioilta sen
mukaan, minkä esi-isän alla se on.

Suositus: yksi mekanismi. Säilytä globaalit `.ah-*`-nimet, koska testit,
labin snapshot ja `App.tsx` viittaavat niihin, mutta jaa tyyli komponentin
viereen (`Navigation.css`, `Conversation.css`, …) ja tuo se komponentin
moduulista. Sääntö: variantti on komponentin oma luokka tai
`data-variant`-attribuutti, ei esi-isän valitsin. Siirrä kaksi
CSS-moduulia samaan tapaan. Tämä on mekaanista ja voidaan tehdä komponentti
kerrallaan hienosäädön yhteydessä, ei kertarysäyksellä.

### E. Sovelluskerros koostaa raakaelementeistä (yhteisen ja paikallisen raja)

`production-v1.md` kieltää ad hoc -kontrollit, mutta ei ad hoc -sommittelua,
ja se näkyy. `App.tsx`:n etusivu on `<h1>Työtilat</h1>` ja `<p>`, joita
tyylittävät `app.css`:n `main h1`- ja `main p`-säännöt; keskustelun
aloitusnäkymä `BrowserConversation.tsx`:ssä on `<h2>Pi-keskustelut</h2>` ja
raaka `<ul>`, jossa linkin tekstinä on `agent_id`; vuoron keskeytyksen
vahvistus on `<fieldset>` kahdella painikkeella; *Natiivi tunniste* on
`<p>`; lukunäkymän *Vain luku* on `InlineNotice` syötteen alla. Näissä
kohdissa designilla on oma komponentti (paluunäkymän keskustelurivit,
Tiedot-paneeli, `AlertDialog`-vahvistus, vain luku -selite kirjoituskentän
tilalla). Kun kohdan B sivupohjat ja kohdan C primitiivit ovat olemassa,
nämä ovat paikallisia korjauksia näkymä kerrallaan.

## Komponenttikartta

Kartta vastaa handoffin pyytämää `handoff-v2-komponenttikartta.md`-tasoa
siltä osin kuin se selittää puutteet. Sarake *Luokka*: **sopii** = tyylimuutos
riittää; **hienosäätö** = komponentin oma rakenne muuttuu; **uusi** =
komponenttia ei ole; **pohja** = riippuu kohdista A–D.

| Vedoksen elementti | Nykyinen | Luokka | Huomio |
| --- | --- | --- | --- |
| Sovelluskehys, katkosbanneri | `AppShell`, `ConnectionBanner` | pohja, hienosäätö | Ohut banneri ja *Yhdistä*; kehys saa sivupohjat (B). |
| Sivupalkki auki, Etusivu-rivi, työtilaryhmä | `WorkspaceRail`, `WorkspaceSection`, `AgentNavItem` | hienosäätö + uusi `RailRow` | Rivillä piste + otsikko + meta; työtilan `+` vaatii luontitoiminnon siirron sivupalkkiin (nyt `BrowserConversation`). |
| Sivupalkki suljettu (52 px kaista) | `ah-rail-collapsed` | uusi `CollapsedRail` | Ikonikaista tarvitsee ikonipainikkeen (C) ja `Menu`-laukaisimen. |
| Tilipainike, avatar, valikko teemavalitsimella | `AccountShelf`, `Menu` | uusi `AccountButton`, `Menu` laukaisin + radiogroup-osio | Nimi ja sähköposti riippuvat `decide-account-display`-sopimuksesta; nimikirjaimet ovat oletus. |
| Keskustelun yläpalkki, tilapilleri, Tiedot ▾ | `AgentHeader`, `AgentFacts` | hienosäätö | Yksirivinen otsikko, pilleri vain poikkeamalle, *Näytä koko otsikko* poistuu; Tiedot chip-rivinä. |
| Viestit (puhujatunniste + ⧉, kupla, teksti) | `Message`, `UserMessage`, `AssistantMessage` | hienosäätö | Lukunäkymän ohitus poistuu (D); kopiointi ikonipainikkeena (C). |
| ✓ Vuoro valmis -rivi | – | uusi `TurnEnd` | Pieni; tieto on `current.state`. |
| Työkaluryhmä ja -rivi | `ToolGroup`, `ToolRow`, `Disclosure` | hienosäätö | Mono-nimi, määrä, tulos; koko otsikko näppäimistöllä (ensiluku). |
| Työ käynnissä | `WorkingProgress` | hienosäätö | Pilleri yläpalkkiin, eteneminen työkalurivin viereen. |
| Kirjoituskehys: Keskeytä · Ohjaa · Lähetä | `Composer` + `RadioGroup` | hienosäätö | Radiot poistuvat; lähetystapa säilyy sovelluksen `workingMode`-tilana. Hylätty ilmoitus kentän yläpuolella on jo `sendState`. |
| Epävarma lähetys viestin alla | `UncertainCommandCard`, kuitti-`InlineNotice` | uusi `UncertainMark` | Näyttömalli on jo olemassa; sijainti ja esitys vaihtuvat. |
| Jono | `QueuePanel` | hienosäätö | Tyhjennys palauttaa Pi:n vahvistamat tekstit (jo toteutettu). |
| Viimeisimpään ↓ / Uutta sisältöä | `ConversationTimeline`-painike | uusi kelluva `JumpToLatest` | Kuuluu keskustelun sivupohjaan (B). |
| Vain luku kirjoituskentän tilalla | `HistoryView`-`InlineNotice` | uusi `ReadOnlyFooter` | Sisältää *Uusi keskustelu* vain, kun luonti on saatavilla. |
| Paluunäkymä: käynnissä, viimeksi avatut | `App.tsx` `ah-continue` | uusi `HomeView`, `ConversationRow` | Käynnissä-tieto puuttuu snapshotista (`activityLabel: ""`); riippuu `build-agent-control`ista. |
| Asetukset: Tili, Yhteydet, Ulkoasu, Istunto | `AccountSettings` | hienosäätö + uusi `SettingsSection` | OpenAI-rivi on ehdotus; Pi:n todellinen tila on saatavilla `piStatus`ista. |
| Onboarding-kehys ja vaiheilmaisin | – | uusi `OnboardingFrame`, `OnboardingSteps` | `LoginCard`, `GitHubRepoChooser`, `PiDeviceSignIn` sovitetaan kehykseen (B). |
| Repolistan rivi ja aikasuodin | `GitHubRepoChooser` checkbox-rivi | uusi `RepoRow` | `role="checkbox"`; osittainen ja epävarma tila säilyvät ensiluvun mukaan; suodattimen oletus on Jarin päätös. |
| Kirjautumiskoodi 24 px, kaksi vaihetta | `PiDeviceSignIn` | hienosäätö | Rakenne on jo vaiheittainen. |
| Keskeytä käyttöönotto -linkki + vahvistus | `danger-subtle`-painike | hienosäätö | Hiljainen linkki ja `AlertDialog` (on olemassa). |
| Puhelimen valikkolaatikko | pinottu sivupalkki | uusi `Drawer` | Laajuus Jarin päätös. |
| Tumma teema | tokenit | sopii | Estetyn painikkeen korjaus tulee `Button`ista. |

## Toteutuspolku

Järjestys perustuu riippuvuuksiin: pohja ensin, koska jokainen hienosäätö
muuten kirjoittaisi omat kokonsa ja ohituksensa uudelleen.

### 0. Jarin päätökset

Kolme asiaa, joissa lopputulos eroaa ja joita en voi päätellä repossa:

- Mobiilin toteutuslaajuus (ensiluku). Suositus: laatikko toteutetaan
  kehystyönä, koska pinottu sivupalkki ei ole käyttökelpoinen ja laatikko
  on yksi komponentti; muut puhelinnäkymät seuraavat samoista sivupohjista.
- Repohaun oletussuodatin (ensiluku). Suositus: kaikki näkyvissä, aikaraja
  käyttäjän valintana.
- V2:n mitoitus tokenien lähteeksi ja `production-v1.md`:n lauseen päivitys
  (kohta A). Suositus: kyllä.

### 1. Pohja (yksi työpuu, yksi hyväksyttävä slice)

- Tokenit: `typography.css` designin taulukkoon (sivun otsikko, keskustelun
  otsikko, leipäteksti, työkalurivi, meta, tunniste, mono, kirjautumiskoodi),
  `spacing.css` asteikkoon, joka kattaa designin arvot, uudet layout-tokenit
  (`--ah-rail-w`, `--ah-rail-w-collapsed`, `--ah-column-max`,
  `--ah-column-pad`, `--ah-home-max`, `--ah-settings-max`), `motion.css`
  2,4 s / 1,4 s pulssit ja 150 ms kytkimet.
- `Button`: variantit `primary | secondary | quiet | danger-subtle | icon`,
  koot `sm | md`, estetyn ulkoasu ilman läpinäkyvyyttä; `Menu` ja `Dialog`
  saavat laukaisinpropsin. Kaikki 11 kontekstiohitusta poistetaan.
- `StatusMark`: `mark: dot | ring | check | cross | question`, `pill`;
  `Badge` sulautetaan.
- `Icon`: inline-SVG, noin kymmenen merkkiä.
- Sivupohjat: `ConversationLayout` (yläpalkki, vierityssarake, kirjoituskehys,
  kelluva painike), `PageColumn` (leveys ja yläväli propseina),
  `OnboardingFrame` + `OnboardingSteps`, ja Jarin päätöksen mukaan `Drawer`.
- `components.css` jaetaan komponenteittain (D). `app.css`:n `main h1`- ja
  `main p`-säännöt poistuvat, kun `PageColumn` hoitaa tyylin.
- Storybook: jokaiselle uudelle primitiiville ja sivupohjalle story sekä
  vaaleana että tummana; `design-system.spec.ts` laajenee mitoitustesteillä
  (alla). Vanhat näkymät saavat näyttää tässä vaiheessa keskeneräisiltä;
  slice hyväksytään gaten ja storyjen perusteella, ei näkymien.

Omistaja: uusi issue, esimerkiksi `build-ui-foundation-v2`, joka estää
seuraavat vaiheet. Se muokkaa `design-system/`-hakemistoa ja
`web/src/components/`-hakemistoa, joten se on ristiriidassa
`complete-conversation-ui`n `collision`-listan kanssa; ajetaan yksin.

### 2. Komponenttien hienosäätö (kolme rinnakkaista työpuuta pohjan jälkeen)

Kukin sovittaa oman alueensa komponentit kartan mukaan, päivittää storyt ja
tuottaa parikuvat vedoksiin (alla). Alueet eivät jaa tiedostoja:

- **Sivupalkki, tili ja asetukset**: `Navigation.tsx`, `Account.tsx`,
  `App.tsx`:n sivupalkkikoostumus. Tilipainikkeen nimi ja sähköposti
  toteutetaan vasta, kun `auth`-skeema kuljettaa ne
  (`decide-account-display`); siihen asti nimikirjaimet ja *Oma tili*.
- **Keskustelu**: `Conversation.tsx`, `WorkingProgress.tsx`,
  `BrowserConversation.tsx` ja `HistoryView.tsx` `ConversationLayout`in
  sisään; yläpalkki, viestit, työkalurivi, kirjoituskehys, jono, epävarma
  lähetys, vain luku. Tämä on `complete-conversation-ui`n omistamaa aluetta
  ja voi kulkea sen alla; sen `blocked_by: build-agent-control` koskee
  toimintaa, ei ulkoasua, mutta *Ohjaa*-painikkeen lupaus riippuu
  ohjaimen todellisesta kyvystä.
- **Onboarding**: `LoginCard.tsx`, `GitHubRepoChooser.tsx`,
  `PiDeviceSignIn.tsx`, `GitHubOnboarding.tsx`, `PiOnboarding.tsx`
  `OnboardingFrame`n sisään; vaiheilmaisin, repolistan rivi, kirjautumiskoodi,
  keskeytysvahvistus. Kuuluu `design-first-use-onboarding`-issuen alle; sen
  toiminnalliset viat (Pilot.12) korjataan samassa alueessa mutta erillisinä
  committeina.

### 3. Näkymien koostaminen

- **Paluunäkymä** `HomeView`n ja `ConversationRow`n varaan. Vaatii
  keskustelukohtaisen käynnissä-tiedon snapshotiin tai ohjaimen listaan;
  odottaa `build-agent-control`ia. `refine-agent-status` (post-MVP) ratkeaa
  käytännössä tällä rivikäsittelyllä; suosittelen sulkemaan sen tämän
  työn viitteellä, kun rivit on hyväksytty.
- **Yksi keskustelureitti** (`decide-account-display`n avoin kohta 2):
  sivupalkin rivit ja paluunäkymä ovat helpompia, kun `/agents/:id` on
  ainoa reitti. Ei estä ulkoasutyötä, mutta kannattaa päättää ennen
  paluunäkymää.
- **Puhelin**: `Drawer` ja 390 px:n tarkistus samoilla sivupohjilla, jos
  laajuus hyväksytään.
- **Nimi**: `rename-omega-habitat` on erillinen; UI käyttää jo Omega
  Habitatia (`LoginCard`, `ah-identity-check-title` sanoo vielä
  "Agent Host" ja korjataan sivupalkkialueessa).

## Miten tarkkuus todetaan

Kolme kerrosta, kevyimmästä raskaimpaan. Kaikki ajetaan synteettisessä
labissa; oikeita profiileja tai testipalvelinta ei käytetä.

1. **Mitoitusväitteet gatessa.** `design-system.spec.ts`:ään Playwright-testi,
   joka lukee lab-näkymän maamerkkielementtien lasketut tyylit (sivupalkin
   leveys auki ja suljettuna, yläpalkin täyte ja tausta, sarakkeen
   maksimileveys, otsikon ja leipätekstin koko, pyöristykset, fokusrengas)
   ja vertaa niitä handoffin mitoitustaulukkoon 1440 px:ssä vaaleana ja
   tummana, ja 390 px:ssä jos mobiili on laajuudessa. Deterministinen, ei
   tarvitse kuvavertailua ja paljastaa tokenin karkaamisen heti.
2. **Parikuvat katselmointiin.** `web/lab/matrix.mjs` saa `--design`-tilan:
   taulukko tilanimistä (uusi, työ, valmis, hylätty, katkos, vain luku,
   asetukset, paluu, sivupalkki suljettu, onboarding 1–3, tumma) ja
   jokaiselle labin näkymä sekä vedoksen sama tila. Vedos avataan omassa
   eristetyssä Playwright-kontekstissa, tila valitaan sen tilavalitsimesta
   ja Google Fonts -pyyntö ohjataan `design-system/fonts/`-tiedostoihin,
   jotta vertailu ei riipu CDN:stä. Tulos on rinnakkaiskuva ja labin
   staattinen HTML issuekansiossa. Jari katselmoi parit; pikselivertailua
   vedokseen ei tehdä, koska aineisto ja tekstit eroavat tarkoituksella.
3. **Pikselibaseline hyväksynnän jälkeen.** Kun näkymä on hyväksytty,
   Playwrightin `toHaveScreenshot` tallentaa labin näkymän baselinen
   tilaa ja teemaa kohti. Myöhempi token- tai komponenttimuutos näyttää
   jalanjälkensä kuvina; baseline päivitetään tietoisesti samassa
   commitissa muutoksen kanssa. Kynnys pieni, yksi Playwright-worker kuten
   nyt.

Axe molemmissa teemoissa, 200 %:n zoom ja reduced motion -testit säilyvät
sellaisinaan ja koskevat myös uusia primitiivejä.

## Tarkistuksen näyttö

Luettu kokonaan: `design-system/` tokenit ja `production-v1.md`,
`web/src/components/` kaikki tuotantomoduulit ja `components.css`,
`web/src/app/App.tsx`, `BrowserConversation.tsx`, `HistoryView.tsx`,
`GitHubOnboarding.tsx`, `PiOnboarding.tsx`, `theme.ts`, `app.css`,
Storybookin `preview.ts`, `web/lab/`-työkalut, `design-system.spec.ts`,
`TESTING.md`, `docs/design-system.md` sekä handoff ja `Selainpolku v2`- ja
`Onboarding v2` -vedosten rakenne. Luvut (fonttikoot 24/5, välit 76/30,
11 painikeohitusta, 247 sääntöä) ovat `grep`-laskentaa `components.css`:stä
revisiossa `82a5c4e`. Kuvat ovat aiempien issueiden synteettisiä
lab-näyttöjä 29.–30.9.; uusia kuvia ei otettu, koska sen jälkeiset
`web/src`-commitit koskevat Pi:n ohjausta ja onboardingin toimintaa, eivät
tyylejä, ja väitteet on tarkistettu suoraan CSS:stä eikä kuvista.

Ei ajettu: Storybookia, labia, gatea eikä vedoksia selaimessa tässä
arviossa (ensiluku avasi vedokset). Arvio ei muuta ajettavaa koodia, joten
gaten poikkeus dokumenttimuutoksille pätee.
