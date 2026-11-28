# Ajastetut ajot, kierros 1 · 28.11.2026

Issue `scheduled-agent-runs`. Konsepti on issuen `design.md`:ssä, ja
päätökset ja kysymykset ovat sen `result.md`:n kohdassa "Kierros 1".

Valitsimen akseli on se, missä ajastukset listataan ja missä niitä hoidetaan:
**A · Paikka** (sivupalkin yläosan oma paikka *Ajastukset* Tuotokset-paikan
vieressä, ja sen sivulla lista ja valitun ajastuksen tiedot; työtilan sivulla
sama lista rajattuna) ja **B · Työtila** (ei paikkaa; ajastukset ja niiden
tiedot ovat vain työtilan sivulla). Kaikki muu on molemmissa samaa:
lomake, ajastuksen sivu ajohistorioineen, ajo sivupalkissa ja keskusteluna,
keskeytetty, epäonnistunut ja väliin jäänyt tila sekä agentin ehdotuskortti.

Tuotannosta, muuttamatta: `AppShell`, `WorkspaceRail` (mukautuvat paikat),
`NowSections`, `QuietSection`, `AgentNavItem`, `WorkspaceNavRow`,
`AgentHeader`, `ConversationFrame`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `Composer`, `WarningBanner`, `Badge`, `Menu`,
`ControlButton`, `Segmented`, `Icon`, `WorkspaceActions`, `WorkspacePage.css`
ja herätysrivin tyyli (`ScheduledWake.css`). Kierroksen omat: paikan tunniste
ja kuvake (`PLACE_ICONS.schedules` asetetaan vain tässä kierroksessa),
ajastusten sivu, lista, tiedot, lomake, Open Habitatin ajorivi ja
ehdotuskortti. Sivun "nyt" on ma 30.11.2026 klo 9.12. Kaikki on
synteettistä.

URL: `?v=1|2` suunta, `?s=` tilanne (`lista`, `tyotila`, `uusi`, `ajastus`,
`tauko`, `virhe`, `keskeytyi`, `ohitettu`, `kaynnissa`, `ajo`, `ajovirhe`,
`myohassa`, `ehdotus`), `?theme=light|dark`. Ilman `?theme=`-valintaa teema
tulee `initialTheme()`-funktiosta. Sivun sisällä muutokset (keskeytys,
poisto, uusi ajastus, ehdotuksen hyväksyntä) säilyvät, kunnes tilanne
vaihdetaan.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu lukkotiedostosta (tai
linkitetty päächeckoutin hakemistoon). Linuxissa scratch-hakemistossa omalla
TMPDIR:llä.

```sh
round=design-system/prototypes/rounds/2026-11-28-ajastetut-ajot-1
node "$round/build.mjs"   # dist/2026-11-28-ajastetut-ajot-1/offline.html ja index.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node "$round/check.mjs" design-system/prototypes/dist/2026-11-28-ajastetut-ajot-1/offline.html <kuvahakemisto> [--quick]
```

`check.mjs`:n alku kertoo, mitä se käy läpi (myös vierekkäisten painikkeiden
asettelun).
