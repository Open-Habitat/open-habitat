# Editor controls — round 2

Review: https://glasspad.example.test/p/7cogzksl7tjffqyjlj3xmhhuee/

## For Jari

Kierros 2 näyttää **Aurinkokello-keskustelun oikean otsakerivin**: työtilan nimi, Valmis, Git-tila, malli ja ajattelutaso, työtilavalikko editorin ollessa auki, editori, pääte, otsikon uudelleenluonti, arkistointi ja tiedot. Editorissa näkyvät tiedostopuu, tiedostovälilehdet ja tilarivi. Editorin avaus- ja kokoikkunaohjaimet ovat pelkkiä kuvakkeita: tuotannon `editor`, `forward` ja `back`, eivät uusi suurenna-symboli tai tekstipainikkeet. Painikkeiden nimet ja vihjeet säilyvät saavutettavina.

Vertaa samoilla keksityillä tiedoilla:

1. **Näkymäpalkki:** keskustelun koko otsakerivi nostetaan jaon yläpuolelle. Editorin avaus ja koko ovat sen muiden toimintojen joukossa ja pysyvät paikallaan myös koko ikkunassa. Tämä on ehdotettu otsakkeen sijoittelumuutos, ei nykyisen tuotannon rakenne.
2. **Oma otsake — suositus:** keskusteluotsake pysyy tuotannon tavoin oikeanpuoleisessa keskustelussa. Avaus on sen editorikuvake; koko ja sulkeminen ovat editorin oikeassa yläkulmassa. Koko ikkunassa editorin omat ohjaimet jäävät näkyviin. Toiminto on muutettavan paneelin vieressä eikä koko otsaketta tarvitse siirtää.
3. **Näkymät:** yhteisessä otsakerivissä on kuvakkeista koostuva kolmen kohteen valitsin: keskustelu / rinnakkain / koko editori. Se korvaa kaksi tilasta riippuvaa toimintoa kolmella suoralla kohteella. Suunnan konsepti säilyy kierroksesta 1, mutta näkyvät tekstipainikkeet on poistettu.

Kokeile kussakin: avaa editori, suurenna, palauta sekä ohjaimesta että keskusteluliuskasta, sulje ja avaa keskustelun tiedostolinkistä. Vaihda teema ja kokeile 390 px esikatselua. Luonnos säilyy tilasiirtymissä; suunnan vaihtaminen aloittaa saman esimerkin alusta.

**Kysymys:** tuntuuko Oma otsake nyt selkeältä oikeiden muiden painikkeiden joukossa, vai haluatko yhteisen otsakerivin? Valintaa ei ole tehty. Issue jää avoimeksi Jarin valintaa varten; tuotantototeutus on myöhempää työtä.

## Source and scope

Read the issue's round-1 decision, `design-system/AGENTS.md`, prototype instructions, production-context bash round and its result, and production `AgentHeader` in `web/src/components/Navigation.tsx`, `WorkspaceEditor.tsx` / `EditorHeaderControls`, `EditorSplit.tsx` / `.css`, `Icon.tsx`, `TerminalPanel.tsx`, `ArchiveControls.tsx`, `SingleWorkspaceBar.tsx`, component CSS and tokens.

This is synthetic HTML, a round-local presentation copy, not React or code-server. The real conversation header's action order, SVGs and wrapping behavior supply the comparison context; model/Git/workspace and non-editor actions are inert context, explicitly marked as such. The editor's tabs/tree/source are simplified synthetic chrome, not a new tab implementation. The 296px closed-state rail, editor-left/conversation-right split, 460px conversation column and full-window return strip follow the prior round and production geometry. A/C intentionally promote the conversation header above the split; B retains its production location. Full-window means the app workspace, not the browser Fullscreen API.

At 390px, panes stack and the pane area scrolls; the conversation and composer remain reachable below the editor. The return strip is horizontal. This is a proposed phone adaptation, not a claim about current production editor support. Both actual 390px browser viewports and the desktop phone-frame affordance are available; automated coverage below uses real viewport widths.

No host facts beyond the existing editor-open/conversation-hidden state and frozen workspace/Pi/model/Git context are introduced. All conversation text, code, filenames, state and counts are invented. No product code, contract, host authority or deployment changed. Publishing included only the generated synthetic HTML, not issue content, screenshots, repository files or machine data. No live host/profile was used.

## Rebuild and checks

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-21-editorin-painikkeet-2
node design-system/prototypes/rounds/2026-10-21-editorin-painikkeet-2/publish-build.mjs
# On a browser-capable machine with Playwright:
node check.mjs 2026-10-21-editorin-painikkeet-2.html evidence
node hosted-check.mjs https://glasspad.example.test/p/7cogzksl7tjffqyjlj3xmhhuee/
```

The two browser scripts live in the round directory. They ran on Cedar in disposable `/var/tmp/oh-proto-editor-round2-04aa1x1vhs`, using the previous round's disposable Playwright 1.58.2 dependency and cached Chromium, without installation or a real browser profile. No local Alder specialist/lab run or product integration evidence is claimed.

- **126 offline state checkpoints passed:** 3 directions × 1440/1366/390px × light/dark × 7 checkpoints. Checks include keyboard opening, closed/split/full, two return routes, draft retention, file-link opening, document/control overflow, editor-left pane ordering, actual Aurinkokello header and its other buttons, and icon-only named editor controls. Zero console/page errors.
- Hosted smoke: **54 transitions passed**, all three directions at each width in each theme, closed → split → full → strip return; zero console/page errors.
- Nine screenshot/static-HTML pairs in `evidence-round2/`: each direction at desktop/light/split, phone/dark/split and phone/dark/full. HTML is script-free, font-embedded and preserves the captured draft. Screenshots are AVIF (converted from the capture script’s PNG output with `avifenc -j 2 -s 8 -q 75 input.png output.avif`). These are authored-prototype captures, not production lab captures.
- Self-review: inspected desktop and phone screenshots; reviewed the correct header's ownership, complete contextual action row, production icon paths, return/focus paths, narrow wrapping, independent tab overflow, preserved draft, accessible names and synthetic-only publication. No independent review or full product gate is required for this isolated visual experiment.
- Prototype build, JS syntax checks, project-view validator, issue doctor and `git diff --check` passed. Doctor's pre-existing attachment-format advisories are not introduced by this round.

Published HTML SHA-256: `3e462d5124764b98fccdf302ab9d75c92928d4d34ca2459a53fbbaa1939ce6f1`. Stable Glasspad key: `open-habitat-proto-editor-buttons-2`; the earlier link remains unchanged.

## Failure inventory and limitations

No required build, check, publication or review remains incomplete. Diagnostic discovery probes found no `*Tab*` component path, no repository `.glasspad.yaml`, and no Cedar `~/.cache/ms-playwright/*` directory (macOS caches differ). Continued from the actual `Navigation.tsx`/editor sources, effective `glasspad config show`, and default cached Chromium; final browser checks passed. No tooling installation or shared service changes were needed. These optional discovery misses did not invalidate an input or require a missing verification.

Glasspad's sandbox blocks embedded fonts (as recorded in round 1). `publish-build.mjs` deliberately removes `@font-face` for hosted output and discloses system-font fallback in the prototype. Offline captures retain production Instrument Sans / JetBrains Mono. This hosting limitation is not a product typography proposal. No failed browser check occurred in this round.

Logs on Alder: `/var/tmp/editor-round2-browser.log`, `/var/tmp/editor-round2-final.log`, `/var/tmp/editor-round2-publish.json`, `/var/tmp/editor-round2-doctor.json`, `/var/tmp/editor-round2-discovery.log`; remote working inputs/evidence are under the disposable path above.

## Round 1

Previous review: https://glasspad.example.test/p/aeex4uefjc42mhrkrvgwfhvyu4/. Sources remain in `design-system/prototypes/rounds/2026-10-21-editorin-painikkeet/`, captures in `evidence/`. Jari found that its generic workspace bar omitted the real conversation title/action row and requested existing icon-only controls; round 2 supersedes that presentation, not a selected product design.
