# Moninpeli 1: asetukset, aloitus, omistaja, osallistuja ja kulmat

Akseli: missä Moninpeli + on ja miltä se näyttää. Sisältö on kaikissa
suunnissa sama, ja yläpalkin Näkymä valitsee alueen.

- **1 Nimetty painike**: työtilan otsikossa Uusi keskustelu ja Moninpeli
  vierekkäin, tavallisen keskustelun otsikossa Moninpeli.
- **2 Ikoni rivissä**: tuotannon työtilan ikonirivissä + ja ihmiset+
  vierekkäin, keskustelun otsikossa sama ikoni (nimi ruudunlukijalle ja
  vihjeenä).
- **3 Tyhjässä**: Uusi keskustelu avaa tyhjän keskustelun, jonka alussa
  valitaan Tavallinen tai Moninpeli; keskustelun otsikossa Moninpeli myöhemmin.

Issue `multiplayer-own-conversation-kind`; inventaario, päätökset ja
kysymykset ovat sen `result.md`:ssä.

## Näkymät

1. **Asetukset**: Ainon AI-sivu (tilaus, oma avain, palvelimen avain;
   Moninpeli-osion malli tai "ei käytettävissä" ja Lisää avain) ja
   ylläpitäjän palvelimen avain, jonka lupa moninpeleihin on oma valintansa.
2. **Aloitus**: työtilasivu, Moninpeli +, aloitusikkuna (nimi, malli vain
   API-avainreiteistä, kutsuttavat) ja uusi merkitty moninpeli; tavallinen
   keskustelu muuttuu moninpeliksi samalla painikkeella, ja ikkuna kertoo
   mallin vaihdon. Ilman avainta painike kertoo syyn ja vie AI-asetuksiin.
3. **Omistaja**: merkki otsikossa ja rivissä, ihmisrivi, osallistujien
   viestit, odottava kortti (Salli kaikki, Hyväksy yksitellen, Älä salli),
   osallistujan poisto.
4. **Osallistuja**: kutsu Jaettu kanssasi -osiossa (Liity / Ei nyt),
   keskustelu ja nauha kentän yllä, Ainon päätöksen saapuminen.
5. **Kulmat** (Tapaus, Kenen silmin): poistettu pyynnön odottaessa, omistaja
   poissa, avain lakkasi toimimasta, monta osallistujaa, arkistoitu.

Yläpalkin `Ville kirjoittaa`, `Maija kirjoittaa`, `Aino sallii` ja
`Aino ei salli` simuloivat toisen ihmisen teot. `?v=1..3`, `?scene=`,
`?corner=`, `?view=owner|guest`, `?key=own|server|none` ja `?theme=`
valitsevat alkutilan; muuten teema tulee `initialTheme()`ista.

## Tuotannon osat

`AppShell`, `WorkspaceRail`, `AgentNavItem`, `WorkspaceNavRow`,
`AccountShelf`, `AgentHeader`, `ConversationFrame`, `ConversationStream`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`Composer` (nauha ja avainilmoitus `beforeField`-paikassa),
`WorkspaceActions`, `PageNotice`, `Segmented`, `Select`,
`Checkbox`, asetusrivit (`Settings.css`), tuotannon dialogirakenne sekä
toimitetut moninpelin osat `PersonAvatar`, `ParticipantMessage`,
`ConversationLine`, `SharedCard` ja luokat `ah-mp-band`, `ah-mp-strip`,
`ah-mp-invite`, `ah-mp-list`. Kierroksen omia ovat Moninpeli + kolmessa
paikassa, aloitus- ja muunnosikkuna, tyhjän keskustelun lajivalinta,
Moninpeli-asetusrivit, moninpelin merkki (otsikossa sana ja kuvake,
puhelimessa kuvake; sivupalkin rivissä kuvake nimen perässä) ja kulmien
tekstit. Kortti on vain omistajalle toimiva; osallistuja näkee sen tilan.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-28-moninpeli-1/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-28-moninpeli-1/check.mjs \
  <out>/offline.html <kuvahakemisto> [--quick]
```

`<out>` on oletuksena `design-system/prototypes/dist/moninpeli-1`.
`web/node_modules` vastaa lukkotiedostoa (`npm ci --prefix web`).
Rakennuksen CSS-varoitukset tulevat tuotannon `Controls.module.css`:stä.
Tarkistus käy kolme suuntaa 1440 ja 390 px:n leveydellä Päivässä ja Yössä
(omistajan näkymä myös Kontrastissa), kaikki viisi aluetta kulkuineen,
vierekkäisyyden (Moninpeli + Uuden keskustelun vieressä samalla rivillä,
lajivalinnat ja kutsun painikkeet vierekkäin), ylivuodon ja puhtaan konsolin.
