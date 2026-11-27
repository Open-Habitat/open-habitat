# Keskustelulinkit – kierros 3

Issuet `conversation-links-prefilled-draft` ja `risky-features-settings`.
Päätökset ja kysymykset ovat ensin mainitun issuen `result.md`:n kohdassa
"Kierros 3".

Kierros 2:n suunta A, Jarin päätöksin: kun linkit eivät ole sallittuja,
työtilan uusi keskustelu avautuu tyhjällä kentällä ja ilmoituksella, jossa on
*Avaa asetus*. Asetukset avautuu kuten tuotannossa, kerroksena näkymän päälle
(`App.tsx` `settingsLayer`, `Settings.css` `.ah-settings-layer`), ja keskustelu
pysyy sen alla piilossa. Kun asetukset suljetaan linkit sallittuina, linkin
viesti tulee kenttään merkin kanssa. Osion nimi on *Vaaralliset toiminnot*.
Valitsimen akseli on kierroksesta 2 auki jäänyt kysymys siitä, missä linkki
tehdään: **A · työtilarivin ⋯** (sivupalkin työtilarivin uusi ⋯-valikko) tai
**A · työtilasivu** (painike työtilasivun otsikkorivin alla). Molemmat
näkyvät vain, kun linkit on sallittu. Muuten suunnat ovat samat.

Tuotannosta, muuttamatta: `AppShell`, `WorkspaceRail`, `WorkspaceNavRow`,
`AgentNavItem`, `AgentHeader`, `ConversationFrame`, `ConversationTimeline`,
`UserMessage`, `Composer` (`fieldQuote`, `beforeField`), `WarningBanner`,
`LoginCard`, `Menu`, `ControlButton`, `Icon`, `WorkspaceActions`,
`Settings.css`, `WorkspacePage.css` ja asetusosioiden lista
(`shownSettingsSections`). Kierroksen omat: linkin merkki ja kortti, puuttuvan
työtilan sivu, osio ja sen vahvistus, työtilasivun kehys (vain otsikkorivi),
työtilarivin ⋯ ja linkin tekemisen ikkuna. Muut asetusosiot näkyvät listassa
mutta eivät avaudu.

URL: `?v=` suunta (1–2), `?s=` tilanne (`pois`, `uusi`, `luonnos`,
`piilotettu`, `eityotilaa`, `kirjaudu`, `pitka`, `tee`, `asetus`, `asetus3`,
`paalla`), `?theme=light|dark|contrast`. Tilanteen valinta asettaa sen
mukaisen linkkiasetuksen. Sivun sisällä asetus säilyy, joten *pois* →
*Avaa asetus* → *Salli…* → sulje näyttää koko kulun. Työtilat, viestit ja
keskustelut ovat synteettisiä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # tai symlinkki päächeckoutin web/node_modulesiin
node design-system/prototypes/rounds/2026-11-27-keskustelulinkit-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-keskustelulinkit-3/check.mjs \
  design-system/prototypes/dist/2026-11-27-keskustelulinkit-3/offline.html <kuvahakemisto> [--quick]
```

`offline.html` on yksi itsenäinen tiedosto fontteineen, `index.html` sama
ilman upotettuja fontteja. `check.mjs`:n alku kertoo, mitä se tarkistaa.
