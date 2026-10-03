# Miksi käyttöliittymän palaute on epäjohdonmukaista, ja mitä sille tehdään

3.10.2026. Koodihavainnot ovat revisiosta `3757e00`. Mittaukset on tehty
synteettisen labin tallentamista näkymistä (`issues/compare-v2-pairs/*-lab.html`),
jotka sisältävät saman tuotantotyylin kuin sovellus. Tutkimuksen teki Claude
Jarin pyynnöstä; kaikki päättely on tässä dokumentissa, ei delegoitu.

## Johtopäätös

Epäjohdonmukaisuus ei ole yksittäisten komponenttien vika eikä kirjaston puute.
Se syntyy siitä, että **vuorovaikutustilat eivät kuulu minkään primitiivin
sopimukseen**. Yhteinen `Button` määrittelee lepotilan ja estetyn tilan, mutta ei
hover-, painettu- tai valittu-tilaa. Siksi jokainen viipale, joka halusi
palautetta, kirjoitti sen omaan näkymäänsä omalla valitsimellaan, ja viipale,
joka ei tullut ajatelleeksi, jätti sen pois. Ne kaksi kontrollia, jotka Jari
koki hyviksi (etusivun keskustelulista ja työtilan nimi sivupalkissa), ovat
täsmälleen ne kaksi paikkaa, joihin joku lisäsi paikallisen hover-säännön.

React Aria Components tuottaa jo kaiken tarvittavan tilatiedon
(`data-hovered`, `data-pressed`, `data-focus-visible`, `data-selected`,
`data-pending`), mutta tyylitiedosto ei viittaa yhteenkään niistä. Kirjasto on
käytössä käytöksen, ei esityksen, perustana. Suositus on käyttää sitä
loppuun asti: pieni primitiivijoukko, jolla on oma tyylimoduuli ja yksi
yhteinen tilaresepti, ja sääntö, että näkymä ei koskaan tyylitä primitiiviä
ulkoapäin. Kirjastovaihtoa ei tarvita, eikä se ratkaisisi havaittuja syitä.

## Mitä mitattiin

Playwright avasi labin tallentamat näkymät ja luki kunkin kontrollin lasketut
tyylit levossa, hiiren päällä ja painettuna. Muutos tarkoittaa, että taustan,
tekstin, reunan, varjon tai ääriviivan arvo vaihtui.

| Kontrolli | Hover | Painettu | Missä |
| --- | --- | --- | --- |
| `Button` primary / secondary / quiet | ei muutosta | ei muutosta | keskustelu |
| Tilivalikon laukaisin (`.ah-account-shelf .ah-button`) | ei muutosta | ei muutosta | sivupalkki |
| Päivitä-painike | ei muutosta | ei muutosta | sivupalkki |
| Agenttirivi (`.ah-nav-link`) | ei muutosta | ei muutosta | sivupalkki |
| Työtilan nimi (`.ah-workspace-row`) | tausta vaihtuu | tausta vaihtuu | sivupalkki |
| Etusivu-rivi (`.ah-rail-home`) | tausta, väri | tausta, väri | sivupalkki |
| Etusivun keskustelulista (`.ah-continue-list a`) | tausta vaihtuu | tausta vaihtuu | etusivu |
| Valikon rivi (`[role=menuitem]`) | ei muutosta | ei muutosta | tilivalikko, molemmat teemat |
| Tiedot-painike, työtilan avausnuoli | ei muutosta | ei muutosta | keskustelu, sivupalkki |

Näppäimistöfokus näkyy kaikissa, koska yksi globaali `button:focus-visible`-
sääntö kattaa elementtityypit. Se on ainoa yhteisesti hoidettu tila.

## Syyt koodista

### 1. Primitiivillä ei ole tiloja

`.ah-button` (`components.css` 340–389) määrittelee mitat, variantin värit ja
`:disabled`-tilan. Siinä ei ole `:hover`-, `[data-hovered]`-, `[data-pressed]`-
tai `[data-focus-visible]`-sääntöä. Koko tyylitiedostossa `data-hovered` ja
`data-pressed` esiintyvät nolla kertaa, vaikka `AriaButton` ja `MenuItem`
asettavat ne joka renderöinnillä. Sama koskee `[role="menuitem"]`-sääntöä
(513–520): padding ja kursori, ei hover- eikä fokustilaa, vaikka React Aria
tarjoaa `data-hovered`, `data-focused` ja `data-selected`.

Kun primitiivi ei tunne tilaa, "johdonmukainen palaute" ei ole asia, jonka
näkymä voisi periä. Se on asia, jonka jokainen näkymä joko muistaa tai unohtaa.

### 2. Palaute lisättiin näkymä kerrallaan

Tyylitiedoston neljä hover-sääntöä tulivat kolmesta eri viipaleesta:

| Sääntö | Commit | Viipale |
| --- | --- | --- |
| `.ah-workspace-row:hover`, `.ah-rail-summary .ah-nav-link:hover` | `c7f2739` 24.9. | sivupalkin integrointi |
| `.ah-continue-list a:hover` | `45e5298` 29.9. | työtilan aloitusnäkymä |
| `.ah-rail-home:hover` | `738bc8b` 30.9. | sivupalkin v2-sovitus |

Kolme sääntöä antaa kolme eri vastausta samaan kysymykseen (`--ah-surface-2`,
`--ah-accent-soft`, `--ah-accent-soft` + `--ah-accent-ink`), ja jokainen on
sidottu näkymän omaan luokkaan. Agenttirivi (`.ah-nav-link`), joka on
sivupalkin yleisin kontrolli, jäi ilman, koska sen tehnyt viipale ei lisännyt
sääntöä ja mikään ei vaatinut sitä.

### 3. Kontrolleja rakennetaan kolmella eri tavalla

- **`Button`-primitiivi**: 29 käyttöpaikkaa pelkästään `Conversation.tsx`:ssä.
- **Raaka `AriaButton` käsin kirjoitetulla luokkamerkkijonolla**: kuusi paikkaa
  `Overlays.tsx`:ssä (`Menu`, `Dialog`, `AlertDialog` laukaisimet ja
  sulkupainikkeet). Tilivalikon avatar-laukaisin on yksi näistä: se saa
  `ah-button ah-button-secondary`-luokat, jotka sivupalkin esi-isävalitsin
  sitten muokkaa koko leveyden flex-riviksi. Jarin "avatar-valikko ei anna
  palautetta" on tämän ketjun tulos.
- **Tavallinen `<button>`, `<a>` tai `Link` omalla luokalla**: noin 28 paikkaa
  (työtilan avausnuoli, Tiedot-painike, työkalurivin avaaja, jonolinkki,
  mobiilin työkalurivi, Etusivu-rivi, agenttirivi, keskustelulistan rivi,
  vain luku -alatunnisteen linkki, välilehdet). Jokaisella on oma ulkoasu ja
  oma, yleensä puuttuva, tilakäsittely.

Sovelluksessa on siis yksi painike-primitiivi ja noin kymmenen muuta
"painikkeen kaltaista" esitystä, joilla ei ole yhteistä alkuperää. Yhteistä
"vuorovaikutteista pintaa" ei ole olemassa.

### 4. Näkymät saavat tyylittää primitiivejä ulkoapäin

`.ah-button`-luokkaan kohdistuu edelleen kahdeksan esi-isävalitsinta
(`.ah-message header .ah-button` kahdesti, `.ah-jump-latest .ah-button`,
`.ah-account-shelf > .ah-button` kolmesti, `.ah-account-settings > .ah-control
.ah-button`). `recut-ui-foundation` kuittasi 30.9. hyväksymiskriteerin
"painikkeen ulkoasu ei riipu esi-isävalitsimesta" täytetyksi; nykyisessä
puussa se ei pidä paikkaansa. Gaten mittatesti (`lab-foundation.spec.ts`)
tarkistaa leveydet, täytteet, fonttikoot ja pyöristykset, mutta ei tiloja
eikä ohitusten puuttumista, joten kriteeri ei ollut koskaan koneellisesti
todennettu.

Tiedoston ensimmäinen rivi on `biome-ignore-all lint/style/noDescendingSpecificity`
(lisätty 24.9. samassa commitissa kuin sivupalkin ohitukset). Ainoa lintti,
joka olisi huomauttanut ohitusten järjestyksestä, on hiljennetty koko
tiedostolta.

Yksi globaali 2 249 rivin tyylitiedosto tekee tämän luonnolliseksi: kun kaikki
säännöt näkevät kaikki elementit, ainoa tapa erikoistaa on esi-isävalitsin.
ADR 0002 sanoo "locally scoped CSS Modules"; käytännössä moduuleja on kaksi
(`GitHubRepoChooser`, `PiDeviceSignIn`) ja kaikki muu on globaalia.

### 5. Tilamerkin laji päätellään merkkijonoista monessa paikassa

`StatusMark`-lajin (`kind`) valitsee 13 kutsupaikkaa seitsemässä tiedostossa.
`WorkspaceRailView` kääntää hostin enumit suomeksi, `AgentNavItem` vertaa
suomenkielisiä otsikoita ("Prosessi käynnissä" → "työssä") ja `NavLink`
päättelee lajin vertaamalla näyttötekstiä ("vain luku", "Tieto vanhentunut").
Tavallinen rivi putoaa ketjun läpi tyhjään merkkijonoon, jolloin merkkiä ei
näy. Jarin havainto puuttuvista tilamerkeistä sivupalkissa on tämän ketjun
oletushaara. Tilojen merkitys kuuluu @refine-agent-status-issueen; tässä
olennaista on, että päättely on hajautettu ja perustuu tekstin
yhteensattumiin, joten yhteinen muutos ei voi välittyä.

### 6. Asettelulle ei ole primitiiviä

Jokainen `Button` kääritään `<span class="ah-control">`-elementtiin
(inline-flex, pystysuunta), jotta estosyy mahtuu alle. Rivissä, jossa on sekä
`Button` että raaka `<button>` tai `<p>`, kohdistus riippuu kääreestä.
Composerissa `.ah-actions`-rivi ja sen jälkeinen `<p class="ah-composer-hint">`
ovat eri lohkoja jo merkkauksessa, joten Lähetä ja Enter-vihje eivät voi olla
samalla rivillä ilman uutta rakennetta (@composer-footer-layout).
"Viimeisimpään" on sticky-laatikko negatiivisella marginaalilla ja
`translateY(-100%)`-siirrolla (`components.css` 1523–1540), joka kelluu
composerin päälle sattumanvaraisesti (@latest-control-obscured). Kumpikin on
seurausta siitä, että toimintorivillä ja kelluvalla kontrollilla ei ole
yhteistä rakennetta, vaan jokainen näkymä sommittelee ne käsin.

### 7. Katalogi ja gate eivät näe tiloja

Storybookissa ei ole yhtään hover-, painettu- tai fokus-tilan storya, eikä
vuorovaikutuslisäosaa (vain `addon-a11y`). Labin kuvat ja mittatestit
tallentavat lepotilan. Mikään ei petä, kun tila puuttuu, joten mikään ei
pysäytä ajautumista.

### 8. Designista puuttuvat vuorovaikutustilat

V2-handoff määrittelee fokuksen (2 px `--ah-accent`, offset 2 px) ja estetyn
painikkeen, mutta ei hover-, painettu- eikä valittu-tilaa. Vedoksen HTML:n
ainoa hover-sääntö on `a:hover { color: var(--acc) }`. Toteuttajat keksivät
tilat itse, koska niitä ei ollut suunniteltu. Jarin 2.10. linjaama työtapa
(designer suunnittelee jokaisen lohkon) koskee myös tätä: tilamatriisi on
designerin työ, jolle agentti toimittaa inventaarion.

## Vaihtoehdot

**Käytetään React Aria Components loppuun asti (suositus).** Kirjasto on jo
asennettu ja tuottaa jokaisen tilan attribuuttina. Se sisältää myös `Link`-
komponentin (react-routerin kanssa `RouterProvider`), `GridList`/`ListBox`-
rivit, `Disclosure`n, `ToggleButton`in ja `Toolbar`in, joilla noin kymmenen
nykyistä käsin tehtyä kontrollia voi korvata. Adoben julkaisema vanilla-CSS-
aloituspaketti näyttää, miten jokainen tila tyylitetään; se on resepti, ei
riippuvuus. Kustannus on primitiivien uudelleenkirjoitus ja noin 35
kutsupaikan siirto; roolin ja nimen perusteella kirjoitetut testit säilyvät.

**Teemattu komponenttikirjasto (MUI, Mantine, Radix Themes, shadcn + Tailwind,
Spectrum 2).** Tilat tulisivat valmiina, mutta designerin ilme ja suomalainen
tiheys vaatisivat kirjaston oman ulkoasun ohittamista. Se on sama
ohitusongelma suuremmalla pinnalla, ja lisäksi ADR 0002:n muutos, uusi
riippuvuus ja visuaalisten gatejen uusiminen. Havaitut syyt eivät ole
puuttuvia kirjasto-ominaisuuksia, joten vaihto ei kohdistu niihin.

**Tailwind + React Aria -liitännäinen.** Tekisi tilat näkyviksi
käyttöpaikassa, eli siirtäisi tyylityksen näkymiin. Se on päinvastainen
suunta kuin tarvitaan: näkymän ei pidä tyylittää primitiiviä.

## Suositeltu rakenne

1. **Jokainen vuorovaikutteinen elementti on primitiivi.** Pieni joukko
   `web/src/components/primitives/`-hakemistossa: `Button`, `IconButton`,
   `LinkRow` (navigaatio- ja listarivit, React Arian `Link`), `MenuItem`,
   `Toggle` (avaajat, Tiedot, työkalurivi), `Field`. Raaka `<button>`, `<a>`
   tai `AriaButton` muualla on virhe, jonka pieni testi toteaa
   lähdekoodista. Biome ei tarjoa tähän sääntöä; grep-testi on rehellinen ja
   riittävä.

2. **Yksi tilaresepti, määritelty kerran.** `interactive.css` määrittelee
   tilat React Arian attribuuttien perusteella (`data-hovered`,
   `data-pressed`, `data-focus-visible`, `data-selected`, `data-disabled`,
   `aria-current`) custom propertyjen kautta: variantti asettaa
   `--ah-i-bg`, `--ah-i-bg-hover`, `--ah-i-bg-pressed`, `--ah-i-fg`,
   `--ah-i-fg-hover`. Tilavalitsimet ovat vain reseptissä. Uusi kontrolli
   valitsee variantin ja perii kaikki tilat. Siirtymä `--ah-transition`.
   Tarvitaan kaksi tai kolme uutta väritokenia (hover- ja painettu-pinta
   per sävy, molemmat teemat); handoff ei antanut niille arvoja, joten
   designer päättää ne, ja sitä ennen käytetään nykyisen paletin
   `--ah-surface-2` ja `--ah-accent-soft` -arvoja väliaikaisina.

3. **Primitiivin tyyli on moduulissa, jota näkymä ei tavoita.** Kunkin
   primitiivin CSS on CSS Module (luokannimet hajautettuja), jolloin
   `.ah-account-shelf > .ah-button` ei voi enää osua. Nykyiset kahdeksan
   ohitusta muuttuvat propseiksi (`fill`, `IconButton`, `variant="floating"`).
   `biome-ignore-all` poistuu. Globaali `components.css` jää koostettujen
   komponenttien asetteluun ja kutistuu sitä mukaa kuin niitäkin siirretään.

4. **Tilamerkin laji päätetään kerran.** Yksi funktio
   (`agentPresentation(agent, status, session)`) palauttaa lajin, sanan ja
   sävyn hostin enumeista; sivupalkki, otsikko ja etusivu käyttävät samaa.
   Suomenkielinen teksti ei koskaan palaa päättelyyn. @refine-agent-status
   määrittelee, mitä tiloja funktio tuntee ja miltä ne näyttävät.

5. **Rivi- ja toimintoriviprimitiivit.** `ActionRow` (painikkeet ja vihje
   samalla perusviivalla, estosyy omalla rivillään) ja `ListRow`
   (ilmaisin | sisältö | perä) antavat composerille, etusivun listalle ja
   sivupalkin riveille saman välistyksen. "Viimeisimpään" on
   `ConversationFrame`n sijoittama kelluva painike, ei sticky-temppu.
   Tämä korjaa @composer-footer-layout- ja @latest-control-obscured-havainnot
   rakenteesta, ei marginaaleista.

6. **Katalogi ja gate kattavat tilat.** Storybookiin "Interaction states"
   -story: primitiivi × tila × teema. Labiin tilamatriisi, joka hoveroi,
   painaa ja fokusoi jokaisen kontrollin ja kuvaa sen. Gateen yleinen
   väite: jokainen `button`, `a[href]`, `[role=menuitem]` ja
   `[role=option]` labin näkymissä on primitiivi (`data-ah-primitive`) ja
   muuttaa vähintään yhtä tyyliarvoa hoverissa ja fokuksessa. Tämä estää
   tyylittämättömän kontrollin syntymisen riippumatta siitä, kuka sen
   kirjoittaa.

7. **Designerin tilamatriisi.** Agentti kokoaa inventaarion (kontrollilajit,
   tilat, nykyiset kuvat) suunnitteluaineistoksi; designer suunnittelee
   tilat; toteutus menee primitiiveihin ja katalogiin. Sama työtapa kuin
   @raw-thinking-history-blocks.

## Toteutuspolku

**Vaihe A, pohja (yksi työpuu).** Tilaresepti ja primitiivit `Button`,
`IconButton`, `LinkRow`, `MenuItem`, `Toggle` moduuleineen; kahdeksan
ohituksen ja `biome-ignore-all`-rivin poisto; gaten primitiivi- ja
tilaväite; Storybookin tilastory. Näytetään Jarin omilla esimerkeillä:
sivupalkin agenttirivit, Päivitä ikonipainikkeena, tilivalikon laukaisin ja
rivit, etusivun lista, composerin painikkeet. Väliaikaiset tokeniarvot
merkitään designerin vahvistettaviksi.

**Vaihe B, loput kontrollit ja rivit.** Tiedot-painike, työtilan nuoli,
työkalurivin avaaja, jonolinkki, mobiilin työkalurivi ja vain luku
-alatunniste primitiiveiksi; `ActionRow` ja `ListRow`; composerin
alatunniste ja Viimeisimpään-painike niiden kautta.

**Vaihe C, esityksen päättely.** `agentPresentation` @refine-agent-status-
designin mukaan; tiliesitys @account-profile-from-github-issuen mukaan samaa
`LinkRow`/`MenuItem`-pohjaa käyttäen.

Vaiheet A ja B eivät muuta hostia, sopimuksia eivätkä komponenttien
vastuunjakoa (näyttömalli sisään, intentio ulos). Ne tarkentavat ADR 0002:ta
sen omaan suuntaan (React Aria käytöksen pohjana, CSS Modules), joten uutta
ADR:ää ei tarvita. Testien roolit ja nimet säilyvät; `.ah-*`-valitsimiin
nojaavat muutamat testit, labin snapshot ja `App.tsx`:n fokuspalautus
päivitetään siirron mukana.

## Miten parannus osoitetaan

Sama Playwright-mittaus kuin yllä ajetaan ennen ja jälkeen: taulukko
kontrolleista eri näkymissä, sarakkeina hover, painettu, fokus, valittu ja
estetty, molemmissa teemoissa. Ennen-tilassa valtaosa riveistä on "ei
muutosta"; jälkeen-tilassa jokainen rivi muuttuu ja muuttuu samalla
tavalla samassa variantissa. Lisäksi yhden tokeniarvon muutos
(`--ah-i-bg-hover`) näkyy kaikissa variantin käyttöpaikoissa yhdellä
kertaa, mikä on sama todiste, jota `recut-ui-foundation` tavoitteli
mitoille.

## Jarille päätettäväksi

Rakenne ei vaihda kirjastoa eikä siirrä vastuita, joten se ei ole
arkkitehtuuripäätös. Kaksi asiaa kaipaa kantaa:

- Hyväksytäänkö suositus edetä vaiheeseen A väliaikaisilla hover- ja
  painettu-väreillä, jotka designer vahvistaa tai korjaa tilamatriisissa.
  Suositus: kyllä; rakenne ei riipu arvoista.
- Pyydetäänkö designerilta tilamatriisi (hover, painettu, fokus, valittu,
  estetty, kesken) primitiiveittäin ja teemoittain nyt, agentin kokoaman
  inventaarion pohjalta. Suositus: kyllä, samassa paketissa kuin
  lohkokirjaston aineisto.
