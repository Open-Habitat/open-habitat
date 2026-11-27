# Keskustelulinkit – kierros 1

Issue `conversation-links-prefilled-draft`. Suunnat, suositus, päätökset ja
kysymykset ovat issuen `result.md`:n kohdassa "Kierros 1".

Linkki chat-viestissä avaa Habitatin uuteen keskusteluun nimetyssä
työtilassa tai nimettyyn olemassa olevaan keskusteluun, ja valmis viesti on
kentässä. Klikkaus ei lähetä mitään. Akseli on se, miten linkin viesti
saapuu: **A Merkitty kenttä** (viesti kentässä, ensimmäinen rivi kertoo
linkistä ja sen väittämästä lähteestä), **B Vahvistus** (arkki ennen
avaamista) ja **C Ehdotus** (kortti kentän yllä, kenttä pysyy omana).
Katselmointipalkin rivi näyttää painetun linkin.

Tuotannosta, muuttamatta: `AppShell`, `WorkspaceRail`, `WorkspaceNavRow`,
`AgentNavItem`, `AgentHeader`, `ConversationFrame`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `Composer` (`fieldQuote`, `beforeField`),
`WarningBanner`, `LoginCard`, `Menu`, `ControlButton` ja `Icon`. Kierroksen
omia: linkin merkki ja kortti (tuotannon lainausluokat), B:n arkki, puuttuvan
työtilan sivu, linkin tekemisen ikkuna ja yläpalkin ⋯-valikko. Tuotannon
valikossa ei ole paikkaa uudelle kohdalle eikä ⋯ näy työpöydällä ennen kuin
rivi lyhenee, joten kierros piilottaa tuotannon painikkeen ja asettaa sen
paikalle tuotannon `Menu`n, jossa linkkikohta on lisänä.

URL: `?v=` suunta (1–3), `?s=` tilanne (`uusi`, `nimetty`, `luonnos`,
`kesken`, `piilotettu`, `eityotilaa`, `arkistoitu`, `eikeskustelua`,
`kirjaudu`, `pitka`, `tee`), `?theme=light|dark|contrast`. *Avaa linkki
uudelleen* toistaa saapumisen. Työtilat, keskustelut ja botti ovat
synteettisiä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # tai symlinkki päächeckoutin web/node_modulesiin
node design-system/prototypes/rounds/2026-11-27-keskustelulinkit-1/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-keskustelulinkit-1/check.mjs \
  design-system/prototypes/dist/2026-11-27-keskustelulinkit-1/offline.html <kuvahakemisto> [--quick]
```

`offline.html` on yksi itsenäinen tiedosto fontteineen, `index.html` sama
ilman upotettuja fontteja. `check.mjs`:n alku kertoo, mitä se tarkistaa.
