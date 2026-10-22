# Editor settings and CodeMirror files

Review: https://glasspad.example.test/p/fsi5kdax57j56swn4c7xmbfqyq/

## For Jari

**Suositus: Puu.** Asetusten editorivalinta on molemmissa suunnissa sama nykyisen Teema-valitsimen segmenttipari: **CodeMirror 6 / VS Code**. Pitkä kenttäryhmä ja selaimen oletusradiot poistuvat. Valitun editorin selitys on omalla rauhallisella rivillään. Puhelimessa kerrotaan erikseen CodeMirrorin käytöstä; työpöydän valinta ei muutu.

Tiedostoille on kaksi vaihtoehtoa samoilla tiedoilla: **Puu** pitää kansiorakenteen ja avoimen tiedoston paikallaan, **Kansiopolku** näyttää yhden kansion kerrallaan ja paluun polun kautta. Suosittelen puuta, koska viereisten tiedostojen vertailu ja oman sijainnin hahmottaminen eivät vaadi edestakaista navigointia. Kansiopolku on kevyempi hyvin syvissä kansioissa. Molemmissa avoin tiedosto ja sana Muokattu erottuvat myös ilman väriä.

Vaihda Asetukset / CodeMirror, avaa kansioita, suodata nimiä ja muokkaa tekstiä. Toisen tiedoston avaaminen kysyy, mitä muutoksille tehdään. Puhelimessa Tiedostot avaa valitsimen editorin päälle; sulkeminen palauttaa tekstin. Teema ja 390 px -esikatselu ovat ylhäällä. **Kysymys: valitaanko Puu vai Kansiopolku?** Toteutusta ei ole tehty, ja issue jää avoimeksi (`preparation: pending`).

## Scope and production context

Axis: persistent hierarchy versus current-directory navigation. The settings proposal is deliberately shared, so the comparison does not bundle an unrelated settings decision with the navigation choice. Both directions use identical invented files, text, conversation and initial selection.

Read the supplied Alder screenshot `/var/tmp/oh-shots/editor-choice.png`, design/prototype instructions, the previous editor-controls round and its result, production `app/EditorSettings.tsx`, `components/Account.tsx`, `Settings.css`, `ControlElements.tsx`, `Controls.module.css`, `BrowserEditor.tsx`/`.css`, `app/WorkspaceEditor.tsx`, `EditorSplit.css`, tokens, and `web/lab/session.mjs`. The authored page copies production presentation rather than mounting React: Settings' 296px workspace rail, 190px section navigation, 720px inner settings measure, actual settings rows, inline segmented-control sizes, 13rem file browser, editor-left/conversation-right split and 440px conversation context. The app rail steps aside while editing. The real conversation title/action context and production icon SVGs are retained; unrelated controls are explicitly inert. The source area is a textarea stand-in, not CodeMirror, VS Code or a language-service demo.

No tabs, file-content persistence, automatic saves, recursive repository search, host cache or new authority is proposed. Only the currently labelled folder's already-loaded file names are filtered. A production tree would keep expanded directory listings as transient view state from the existing directory reads, not invent a new host registry. A deep filename demonstrates ellipsis/title on desktop and the phone's scrolling picker. Dirty-file confirmation demonstrates the existing document-lifetime rule, not a force-save or uncertain-save solution. The synthetic save succeeds immediately and does not demonstrate conflict, loading, refusal or uncertainty handling. Those existing product states must remain in a later implementation.

At 390px the picker overlays only the editor body and scrolls; conversation and composer remain reachable below. Settings explicitly edits the *desktop preference*, including on a phone, while the preview remains CodeMirror. This is a proposed clarification of the current compact-layout presentation, not evidence of engine switching. Switching preview surfaces preserves the synthetic in-memory buffer; switching directions resets the fixture.

Only generated synthetic HTML was published, never the repository directory, lab captures, issue text, supplied screenshot, machine paths or personal data. Hosted output uses token fallback fonts because Glasspad blocks embedded fonts. Offline evidence embeds production Instrument Sans / JetBrains Mono. This hosting limitation is not a typography recommendation.

## Rebuild and verification

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-22-editori-ja-tiedostot
node design-system/prototypes/rounds/2026-10-22-editori-ja-tiedostot/publish-build.mjs
# On a browser-capable machine with Playwright and cached Chromium:
node check.mjs 2026-10-22-editori-ja-tiedostot.html evidence
node check.mjs https://glasspad.example.test/p/fsi5kdax57j56swn4c7xmbfqyq/ hosted-evidence
```

The round-local `check.mjs` ran on Cedar in `/var/tmp/oh-settings-browser-01m5h220`, using the previous round's disposable Playwright 1.58.2 dependency and cached Chromium, without installing a browser or using a real profile.

- **120 offline checkpoints passed**, and **120 hosted checkpoints passed**: 2 directions × 1440/1366/390px × light/dark × 10 checkpoints. Includes Settings selection and description, keyboard selection, editor/picker opening, no-result and matching filters, folder collapse/expansion or breadcrumb navigation, long filename, opening another file, dirty confirmation/cancel/discard, explicit save, and buffer retention across preview surfaces. Document and visible-control overflow checked at each checkpoint. Zero console/page errors in both final runs.
- **10 authored screenshot/static-HTML pairs** in `evidence/`: shared settings at desktop/light and phone/dark, plus each direction's files and dirty states at those widths/themes. Static snapshots are script-free, font-embedded and retain the captured textarea contents. Images are AVIF, converted with `avifenc -j 2 -s 8 -q 75`.
- **3 current production-lab screenshot/static-HTML pairs** in `production-context/`: Settings › Editori, Settings › Ulkoasu and the actual CodeMirror file picker with `cmd/main.go` open, at 1440px/light. `lab-check.mjs` used `web/lab/session.mjs`'s marker-verified snapshot helper, fresh fake-provider Alice and synthetic homes. The Go host ran in Cedar's Podman Linux VM; Chromium reached its loopback TLS listener through an SSH tunnel. This is synthetic host-backed presentation context, not real-user/provider or distinct-UID evidence. Comparing these captures corrected the authored page's inner settings measure, settings navigation SVGs, CodeMirror header and 440px conversation width before rerunning both full browser matrices.
- Self-review inspected desktop tree, phone tree, phone settings, contextual header, narrow picker scrolling, open/dirty words, filter scope, long names and dialog behaviour. No independent model review or full product gate is claimed for this presentation-only experiment.
- Build, JS syntax, project-view validator, issue doctor and `git diff --check` passed. Doctor's existing attachment-format advisories are unrelated to this round.

Published HTML SHA-256: `bcde5b23444dddc2078755f434a7c9a6c2c97c5c5d09c468ca1affd91b71c149`. Stable Glasspad space key: `open-habitat-proto-editor-settings-filetree`.

## Failure inventory

Final authored offline and hosted browser matrices are complete. Initial offline confirmation checking raced the asynchronous dialog close; the check now waits for the new filename. The first hosted run exposed native `form method=dialog` submission being blocked by the sandbox. Replaced it with explicitly typed buttons calling `dialog.close()`, then repeated both complete matrices successfully. The round also disables the library's conversation-following scroll so the phone starts at the top of the comparison.

Production-lab recovery: the first macOS build could not resolve `ServerAdministration.tsx` beside lower-case `serverAdministration.ts`; an explicit `.tsx` import was applied **only to the disposable source copy** for bundling. The resulting native Go build then refused Linux-only integrations. An initial Podman connection probe found its VM stopped. Started that VM, cross-compiled the unchanged Go host for Linux/arm64, transferred the bundle and ran the lab there. Fresh npm's Playwright expected uncached Chromium 1243, so the capture script instead used the already-working older Playwright/cached Chromium from the prototype checks, while retaining the production snapshot helper. All three production captures then passed, with zero page errors. The existing Podman VM was returned to its original stopped state; no global package/browser installation or persistent binary setup was performed. npm reported its Node-version mismatch and existing dependency advisories; this is not an npm audit or supported-toolchain product gate.

The initial Glasspad publication succeeded but its attempted local browser open failed through `xdg-open` (Alder has no browser/seat). Subsequent publication used `--no-open`; the public page was independently opened and exercised in the hosted Chromium matrix.

Initial source-discovery commands used obsolete component/test paths. Continued from the actual `app/` editor and `browser-editor`/`lab-browser-editor` tests, with no missing source input. Logs live under `/var/tmp/oh-settings-proto/` on Alder; disposable remote inputs/evidence live under `/var/tmp/oh-settings-browser-01m5h220` on Cedar. No product code, contract, service deployment or installed application CLI changed; nothing was pushed.

Integration: the first `taskfleet run merge` stopped on concurrent `KOKEILTAVAA.md` prototype additions. Resolved by retaining the other two rounds and this round under the existing Prototyypit heading, preserving Testikone and the updated retitle instructions. No product-source conflict.
