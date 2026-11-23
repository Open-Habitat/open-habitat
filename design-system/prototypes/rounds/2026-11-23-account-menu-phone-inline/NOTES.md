# Tilivalikko puhelimessa, kierros 2 (näkymässä toimiva)

Issue `account-menu-phone`. Tämä on kierros 1:n
(`2026-11-22-account-menu-phone`) uudelleenrakennus samoilla suunnilla ja
kysymyksillä. Kierros 1 latasi kummankin puhelimen `<iframe>`-kehykseen, ja
Habitat-näkymän sandbox-CSP (`frame-src 'none'`) esti ne: jokainen puhelin
näytti "This content is blocked". Tässä kierroksessa puhelimet ovat sivun
sisällä, ilman kehyksiä, navigointia tai verkkoa (ks. *Puhelin sivun
sisällä* alla).

Tilivalikon kierros 1 (`2026-11-22-account-menu`)
ratkaisi valikon sisällön ja järjestyksen: Jari valitsi A Ryhmät, ja
ryhmät erotetaan pelkillä erottimilla ilman näkyviä otsikoita. Puhelin
jäi auki. Tänään puhelimessa tilinappi on navigointilaatikon alareunassa,
ja se avaa tuotannon ponnahdusvalikon (`Account.tsx`, `AccountShelf`,
`placement="top start"`) laatikon sisään.

Akseli: **mitä laatikon henkilörivi avaa puhelimessa**. Sisältö on
kaikissa suunnissa kierroksen 1 A: Asetukset, Palvelimen ylläpito (vain
ylläpitäjälle) | Selitä tämä näkymä, Palaute Habitatista… | Teema,
Agentin työ, Äänet | Kirjaudu ulos…

- **A Arkki**: koko levyinen arkki nousee alareunasta laatikon päälle.
  Rivit ovat sormen korkuisia (44 px, segmentit 36 × 40 px). Arkki
  sulkeutuu, kun sitä pyyhkäisee kahvasta alas, kun käyttää puhelimen
  takaisin-elettä, kun napauttaa arkin yläpuolelle tai kun painaa Esc.
  Laatikko jää auki arkin alle.
- **B Ponnahdus**: tämän päivän ponnahdusvalikko laatikon sisällä A:n
  järjestyksessä. Se on yhtä leveä kuin henkilörivi, josta se kasvaa.
  Valikko sulkeutuu ulkopuolisella napautuksella, takaisin-eleellä tai
  Escillä.
- **C Tilisivu**: henkilörivi (nuoli oikealle) avaa koko näytön
  Tili-sivun. Sivun yläpalkissa on takaisin-nuoli. Palaute ja
  uloskirjautumisen vahvistus avautuvat sivun päälle, joten takaisin vie
  Tili-sivulle. Sivulta pääsee pois myös reunapyyhkäisyllä vasemmasta
  reunasta tai takaisin-eleellä.

Kaikissa suunnissa jokainen auki oleva kerros on yksi historiamerkintä
(`state.am` on syvyys). Puhelimen takaisin-ele sulkee siksi täsmälleen
yhden kerroksen, ja sivun omat sulkemiset kulkevat `back()`:n kautta,
joten ne eivät joudu ristiriitaan. Prototyypissä historia on puhelimen
oma muistihistoria (`PhoneHistory`), koska kaksi puhelinta jakaa yhden
ikkunan; toteutuksessa se on selaimen `history`. *Selitä*,
*Asetukset* ja *Palvelimen ylläpito* sulkevat kaikki kerrokset ja
laatikon ja näyttävät ilmoitusrivin ("Prototyyppi: … avautuisi").
*Palaute Habitatista…* on A:ssa ja B:ssä alareunan arkki, jonka alla
laatikko sulkeutuu. C:ssä se on Tili-sivun alasivu. Luonnos säilyy, jos
paneelin sulkee takaisin-eleellä ja avaa uudelleen. *Kirjaudu ulos…* avaa
tuotannon vahvistuksen (`AccountLogoutDialog`).

Sivu on tuotannon kehys: `AppShell` ja sen puhelinlaatikko,
`WorkspaceRail`, `NowSections`, `WorkspaceNavRow`, `AgentHeader`,
aikajana, `Composer`, `AccountIdentity`, `AccountLogoutDialog`,
`ControlButton`, `ControlMenuItem` ja `Segmented`. Valikko käyttää React
Arian `Menu`-, `MenuSection`- ja `Separator`-komponentteja, B lisäksi
`MenuTrigger`- ja `Popover`-komponentteja, ja arkki, sivu ja paneeli
`ModalOverlay`-, `Modal`- ja `Dialog`-komponentteja. Sisältö on
synteettistä.

Katselmointisivulla on kaksi puhelinta vierekkäin samassa mittakaavassa:
390 × 844 ja 360 × 640. Kummassakin valikko on auki. Puhelimen alla oleva
*◁ Takaisin-ele* lähettää sille puhelimen takaisin-eleen. Kun koskettaa
toista puhelinta, toisen puhelimen kerrokset sulkeutuvat: React Arialla
on yksi päällekkäisten kerrosten pino koko sivulle, ja muuten napautus
yhdessä puhelimessa sulkisi toisen puhelimen valikon eikä tekisi mitä
napautettiin.
Katselmointipalkissa ovat teema, kieli, tili (Ylläpitäjä tai Tavallinen
käyttäjä), *Näytä* (Valikko auki, Palaute auki tai Kirjaudu ulos auki) ja
*Avaa alusta*.

Osoitevalinnat: `?v=1..3`, `?theme=dark|contrast`, `?lang=en`,
`?admin=0`, `?show=menu|feedback|logout` ja `?night=1`. Puhelinkehys on
sama sivu valinnoilla `?bare=1&d=0..2`; silloin yksi puhelin täyttää
ikkunan.

## Puhelin sivun sisällä

- Puhelin (`Device`) on `div`, jolla on `container: am-device / size`,
  ja katselmointisivulla se pienennetään `transform: scale()`:lla.
  Kokorajaus tekee siitä tuotantokehyksen kiinteiden kerrosten
  (`position: fixed`) sisältävän lohkon.
- `build.mjs` kirjoittaa tuotannon CSS:n (`web/src`, `design-system/tokens`)
  ja kierroksen CSS:n vastaamaan puhelinta eikä ikkunaa: leveys- ja
  korkeusmediakyselyt muuttuvat konttikyselyiksi, `:root`, `html` ja `body`
  niiden sisällä muuttuvat `.am-screen`:ksi, näkymäyksiköt (`vh`, `dvh`, `vw`)
  muuttuvat konttiyksiköiksi, ja `hover`/`pointer`-kyselyt saavat
  kosketuspuhelimen vastauksen. Tuotannon lähdetiedostoja ei muuteta.
- `window.matchMedia` vastaa leveys- ja korkeuskyselyihin puhelimen
  (390 × 844) mukaan, koska sivun kaikki tuotantokomponentit ovat
  puhelimessa.
- React Arian kerrokset ohjataan puhelimen omaan elementtiin
  (`UNSAFE_PortalProvider`). Sivun omat telineet (katselmointipalkki,
  valitsin, puhelinten kuvatekstit ja kehykset) eivät suostu `inert`- tai
  `aria-hidden`-tilaan, jotta yhden puhelimen auki oleva valikko ei
  jäädytä toista puhelinta tai palkkia. Puhelimen sisällä piilotus toimii
  kuten tuotannossa.
- `fetch` ei lähde sivulta: palvelinkysely saa synteettisen vastauksen ja
  muu 404:n.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-23-account-menu-phone-inline/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-23-account-menu-phone-inline/check.mjs \
  design-system/prototypes/dist/account-menu-phone-inline/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla, yksityisellä
`TMPDIR`:llä ja `umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/account-menu-phone-inline/` tiedostot
`offline.html` (fontit upotettuina) ja `index.html` (ilman fontteja).
`check.mjs`:n alussa kerrotaan, mitä se tarkistaa. Näkyvyyden lisäksi se
tarkistaa, että valikko, paneeli ja vahvistus ovat päällimmäisinä, eli
napautus niiden keskelle osuu niihin. Jokainen sivu avataan Habitat-näkymän
CSP:llä, jonka tarkistus lukee yhdyskäytävän lähteestä
(`internal/gateway/views_linux.go`, `viewHeaders`): tarkistus kaatuu
CSP-rikkomukseen, dokumentin jälkeiseen pyyntöön, navigointiin ja
kehykseen. Kierros 1:n sivu kaatuu siinä heti (`no frames`).
