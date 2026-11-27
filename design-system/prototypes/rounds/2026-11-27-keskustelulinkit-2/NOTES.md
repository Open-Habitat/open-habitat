# Keskustelulinkit – kierros 2

Issuet `conversation-links-prefilled-draft` ja `risky-features-settings`.
Päätökset, osion suunnittelu ja kysymykset ovat ensin mainitun issuen
`result.md`:n kohdassa "Kierros 2".

Suunta A (merkitty kenttä) kierrokselta 1 ilman keskustelun nimeä ja lähdettä:
linkki avaa uuden keskustelun työtilassa, ja viesti on kentässä. Linkit ovat
uuden asetusosion (*Sallitut riskit*) ensimmäinen jäsen, oletuksena pois.
Valitsimen akseli on kierroksen ainoa uusi kysymys: mihin linkki vie, kun
linkit eivät ole sallittuja. **A · oma sivu** ei avaa mitään, kertoo mitä
linkki tekisi ja näyttää viestin vain luettavana; **A · tyhjä kenttä** avaa
työtilan uuden keskustelun tyhjällä kentällä ja ilmoituksella. Muut tilanteet
ovat samat molemmissa.

Tuotannosta, muuttamatta: `AppShell`, `WorkspaceRail`, `WorkspaceNavRow`,
`AgentNavItem`, `AgentHeader`, `ConversationFrame`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `Composer` (`fieldQuote`, `beforeField`),
`WarningBanner`, `LoginCard`, `Menu`, `ControlButton`, `Icon`,
`Settings.css` ja asetusosioiden lista (`shownSettingsSections`). Kierroksen
omia: linkin merkki ja kortti, linkit-pois-sivu, puuttuvan työtilan sivu,
riskiosio ja sen vahvistus, yläpalkin ⋯-valikon linkkikohta ja linkin
tekemisen ikkuna. Muut asetusosiot näkyvät listassa mutta eivät avaudu.

URL: `?v=` suunta (1–2), `?s=` tilanne (`pois`, `uusi`, `luonnos`,
`piilotettu`, `eityotilaa`, `kirjaudu`, `pitka`, `tee`, `asetus`, `asetus3`,
`paalla`), `?title=` osion nimivaihtoehto (0–2), `?theme=light|dark|contrast`.
Tilanteen valinta asettaa sen mukaisen linkkiasetuksen; sivun sisällä
asetus säilyy, joten *pois* → *Avaa asetus* → *Salli…* → *Palaa linkkiin*
näyttää koko kulun. Työtilat, viestit ja keskustelut ovat synteettisiä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # tai symlinkki päächeckoutin web/node_modulesiin
node design-system/prototypes/rounds/2026-11-27-keskustelulinkit-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-keskustelulinkit-2/check.mjs \
  design-system/prototypes/dist/2026-11-27-keskustelulinkit-2/offline.html <kuvahakemisto> [--quick]
```

`offline.html` on yksi itsenäinen tiedosto fontteineen, `index.html` sama
ilman upotettuja fontteja. `check.mjs`:n alku kertoo, mitä se tarkistaa.
