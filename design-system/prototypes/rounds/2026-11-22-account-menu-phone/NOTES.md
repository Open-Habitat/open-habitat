# Tilivalikko puhelimessa

Issue `account-menu-phone`. Kierros 1 (`2026-11-22-account-menu`)
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
(`history.state.am` on syvyys). Puhelimen takaisin-ele sulkee siksi
täsmälleen yhden kerroksen, ja sivun omat sulkemiset kulkevat
`history.back()`:n kautta, joten ne eivät joudu ristiriitaan. *Selitä*,
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
390 × 844 ja 360 × 640. Kummassakin valikko on auki. Kehyksen alla oleva
*◁ Takaisin-ele* lähettää kehykselle puhelimen takaisin-eleen.
Katselmointipalkissa ovat teema, kieli, tili (Ylläpitäjä tai Tavallinen
käyttäjä), *Näytä* (Valikko auki, Palaute auki tai Kirjaudu ulos auki) ja
*Avaa alusta*.

Osoitevalinnat: `?v=1..3`, `?theme=dark|contrast`, `?lang=en`,
`?admin=0`, `?show=menu|feedback|logout` ja `?night=1`. Puhelinkehys on
sama sivu valinnoilla `?bare=1&d=0..2`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-account-menu-phone/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-account-menu-phone/check.mjs \
  design-system/prototypes/dist/account-menu-phone/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla, yksityisellä
`TMPDIR`:llä ja `umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/account-menu-phone/` tiedostot
`offline.html` (fontit upotettuina) ja `index.html` (ilman fontteja).
`check.mjs`:n alussa kerrotaan, mitä se tarkistaa. Näkyvyyden lisäksi se
tarkistaa, että valikko, paneeli ja vahvistus ovat päällimmäisinä, eli
napautus niiden keskelle osuu niihin.
