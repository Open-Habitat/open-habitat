# Tilivalikko: järjestys, kuvakkeet, palaute ja puhelin

Issue `account-menu-round`, johon on yhdistetty `general-feedback-entry`.
Jarin palaute 22.11.2026: valikon järjestys on outo, koska Selitä tämä
näkymä on Asetusten ja Palvelimen ylläpidon välissä. Selitän kuvake
kuuluu kohdan eteen, ja kuvakkeita voisi olla kaikissa kohdissa. Palaute
Habitatista pitää saada tilivalikosta, ja koko valikon pitää toimia myös
puhelimessa.

Akseli: **valikon ryhmittely ja järjestys sekä se, kuinka paljon siitä
on kuvakkeita**. Kaikissa suunnissa sisältö on sama. Asetukset ja
Palvelimen ylläpito ovat vierekkäin, koska kumpikin avaa sivun. Selitä ja
Palaute ovat yhdessä apuna. Palvelimen ylläpito näkyy vain ylläpitäjälle.
Kirjaudu ulos on viimeisenä. Jokaisella toimintorivillä on kuvake
edessään, ja Selitän kuvake on yläpalkin `?`.

- **A Ryhmät**: sivut | apu | pikavalinnat nimineen (Teema, Agentin työ,
  Äänet) | Kirjaudu ulos. Näppäimistörakenne on sama kuin tuotannossa:
  ensin valikko, jossa liikutaan nuolinäppäimillä, sitten rivit, joihin
  pääsee Tabilla, ja lopuksi valikko, jossa on Kirjaudu ulos.
- **B Vain toiminnot**: Teema ja Agentin työ siirtyvät Asetuksiin.
  Jäljelle jää yksi valikko, jonka kaikki rivit kuljetaan
  nuolinäppäimillä. Hiljaa tällä laitteella on valintarivi (`menuitemcheckbox`).
- **C Pikarivi**: pikavalinnat ovat kuvakerivinä nimen alla: teeman neljä
  kuvaketta, silmä ja kaiutin. Alla on tila sanoina ja sen alla samat
  toiminnot kuin A:ssa.

Puhelimessa valikko on kaikissa suunnissa arkki, joka nousee laatikon
alareunasta. Rivit ovat kosketuskorkeita (44 px), ja arkin ulkopuolinen
napautus sulkee sen. *Palaute Habitatista…* avaa yleisen palautepaneelin
(explain-f-reminder, kierros 2). Työpöydällä se on ikkuna sivupalkin
vieressä ja puhelimessa alareunan arkki. Paneeli kertoo ennen lähetystä,
että palaute avautuu julkisena GitHub-issuena, mitä siihen tulee
automaattisesti ja mitä ei koskaan. *Näytä, mitä lähtee* näyttää koko
issuen.

Sivu on tuotannon kehys: `AppShell`, `WorkspaceRail`, `NowSections`,
`WorkspaceNavRow`, `AgentHeader`, aikajana, `Composer`, `AccountIdentity`,
`ControlButton`, `ControlMenuItem` ja `Segmented`. Valikko käyttää React
Arian `MenuTrigger`-, `Popover`-, `Menu`-, `MenuSection`- ja
`Separator`-komponentteja suoraan. Valikon sisältö, paneeli ja
ilmoitusrivi ("Prototyyppi: … avautuisi") ovat kierroksen omia osia.
Sisältö on synteettistä.

Katselmointipalkissa ovat teema, kieli, tili (Ylläpitäjä tai Tavallinen
käyttäjä), laite (Molemmat, Työpöytä tai Puhelin) ja Avaa alusta.
Oletusnäkymässä valikko on auki työpöydän kehyksessä, ja sen vieressä on
390 px:n puhelinkehys, jossa valikko on myös auki. Kapeassa ikkunassa
(alle 1180 px) Molemmat näyttää vain työpöydän. Alle 800 px:n ikkuna on
itse puhelin.

Osoitevalinnat: `?v=1..3`, `?theme=dark|contrast`, `?lang=en`, `?admin=0`,
`?device=desktop|phone` ja `?night=1` (laite on yötilassa, ja äänirivi
kertoo sen). Puhelinkehys on sama sivu valinnoilla `?bare=1&d=0..2`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-account-menu/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1200 \
  node design-system/prototypes/rounds/2026-11-22-account-menu/check.mjs \
  design-system/prototypes/dist/account-menu/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä
ja `umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/account-menu/` tiedostot `offline.html`
(fontit upotettuina) ja `index.html` (ilman fontteja). `check.mjs`:n
alussa kerrotaan, mitä se tarkistaa.
