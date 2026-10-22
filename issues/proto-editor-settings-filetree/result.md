# Editor settings and CodeMirror files · round 2

Review: https://glasspad.example.test/p/oj2sbn7anwp77qcxhxpdgjluxy/

## For Jari

**Suositus: Viivasto.** Avoin tiedosto erottuu neutraalilla rivipinnalla, lihavoinnilla ja sanalla **Auki**. Vasemman reunan väriraitaa ei ole. Puiden sisäiset, harmaat apuviivat kertovat kansiosuhteista; näppäimistöfokus on erillinen kehys. Tallentamaton tiedosto näyttää **● Muokattu** — ei Git-muutosta tarkoittavaa M-merkkiä.

Vertaa **Viivastoa**, ilman apuviivoja ja tiedostokuvakkeita toimivaa **Pelkistettyä** sekä yhden alikansion ketjut yhdistävää **Tiivistettyä** (`lib / status`). Kaikissa on samat tiedostot ja sama asetusten CodeMirror 6 / VS Code -segmenttivalitsin kuin ensimmäisellä kierroksella. Kokeile kansioita, nimisuodatusta ja muokkausta; nuolinäppäimet siirtävät puussa fokusta avaamatta tiedostoa. Puhelimessa Tiedostot avaa vieritettävän valitsimen editorin päälle.

**Kysymys: otetaanko Viivasto, vai auttaako Pelkistetyn rauhallisuus tai Tiivistetyn lyhyempi puu enemmän?** Tämä on vain prototyyppi. Issue jää avoimeksi, `preparation: pending`.

## Research before the riff

Read on 2026-10-22. The comparison is about **hierarchy scaffolding**, not importing another editor's whole Explorer. VS Code, Zed, Lapce and Theia are open-source references; IntelliJ's help and GitHub's public design system are additional references, not claims that Fleet, Sublime or GitHub's complete web application are open source. Fleet and Sublime were not used as evidence. Screenshots below are **references to upstream images**, not captures of installed editors or redistributed assets.

| Reference | What the inspected material supports | What carries into this round |
| --- | --- | --- |
| **VS Code** — [Explorer and advanced tree navigation](https://code.visualstudio.com/docs/getstarted/userinterface), [tree CSS](https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/tree/media/tree.css), [list state styling](https://github.com/microsoft/vscode/blob/main/src/vs/platform/theme/browser/defaultStyles.ts), [Explorer configuration](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/files/browser/files.contribution.ts) | Separate twistie, icon/content and indentation-guide geometry; separate focus, active-selection, inactive-selection and hover tokens. `explorer.compactFolders` combines single-child folder chains. Explorer Find can highlight or filter, and can use fuzzy matching. File icon themes are configurable, not an inherent requirement of a tree. | Stable disclosure slot; distinguish the open document from keyboard focus. Compare full hierarchy with compact chains. Keep filtering explicitly bounded rather than imitate VS Code's broader capabilities. |
| **Zed** — [`project_panel` defaults](https://github.com/zed-industries/zed/blob/main/assets/settings/default.json), [panel implementation](https://github.com/zed-industries/zed/blob/main/crates/project_panel/src/project_panel.rs) | Settings expose `file_icons`, folder indicator (`icon` / `chevron` / `both`), 20px indentation, always/never guides, automatic single-child folding, auto-reveal, Git status and horizontal scrolling. Selection and Git-aware filename presentation are separate in the implementation. | Guides, icon restraint and compact folders are independent decisions. Use a modest 14px indentation here because this is a narrow single-file editor, not a full IDE. No per-file language-colour palette or Git decorations. |
| **Lapce** — [file explorer view](https://github.com/lapce/lapce/blob/master/lapce-app/src/file_explorer/view.rs) | The inspected implementation uses `level * 10` indentation, separate directory disclosure and file/folder SVGs, and full-row hover/current backgrounds. Source-control diff text colour is handled separately. | Full-row selection does not need an edge stripe. A small monochrome document icon can help scanning without implementing a file-icon theme system. |
| **Eclipse Theia / OpenVSCode** — [Theia navigator widget](https://github.com/eclipse-theia/theia/blob/master/packages/navigator/src/browser/navigator-widget.tsx), [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) | Theia's navigator builds on its FileTreeWidget and has model selection distinct from opening resources. OpenVSCode is a VS Code-derived server distribution, not an independent visual direction. We do not count it as a second independent design example or infer all VS Code defaults apply unchanged. | Do not conflate selected navigation target with an opened document. No separate fourth variant merely labelled “OpenVSCode”. |
| **IntelliJ IDEA** — [Project tool window](https://www.jetbrains.com/help/idea/project-tool-window.html) | Documents optional tree indent guides, compact empty middle packages, speed search, folder-first sorting and preview. Its file-status colour table is VCS status; it is not evidence of an unsaved editor buffer. | Compare guides with no guides; borrow compact hierarchy, not package-aware semantics. Do not use Git/VCS markers to mean “unsaved”. |
| **GitHub web-tree vocabulary** — [Primer TreeView](https://primer.style/product/components/tree-view/) | Public interactive examples show disclosure, hierarchy, a `current` item, optional leading file/directory visuals and labelled trailing change indicators. The page also supplies a flat/without-indentation variant. This is component-level evidence, **not a live audit of github.com's repository browser**, nor proof of its current filter scope or compact-folder behaviour. | Keep file labels primary, use explicit accessible current/dirty labels, and distinguish navigation from change indicators. We deliberately do **not** copy an active edge marker. |

### Screenshots by reference

- [VS Code full workbench](https://code.visualstudio.com/assets/docs/editing/userinterface/hero.png): inspected the expanded Explorer at left, aligned file-icon column and full-row selected `arrays.ts` without a selection edge stripe. This is the upstream illustrative screenshot, not a current default-theme guarantee.
- [VS Code Explorer filter](https://code.visualstudio.com/assets/docs/editing/userinterface/file-explorer-filter.png): inspected `css` filtering, retained parent hierarchy, highlighted text and a row-wide current item. Our filter is intentionally simpler and does not claim fuzzy matching or repository scanning.
- [IntelliJ guides OFF / ON](https://resources.jetbrains.com/help/img/idea/2026.2/tree-indent-guides.png): inspected the paired hierarchy example; thin interior guides clarify parents without turning into a coloured selection bar. Its package compaction is not identical to generic folder compaction.
- [GitHub Primer interactive reference](https://primer.style/product/components/tree-view/): see **With leading and trailing visuals** and **Without indentation**. This is a browser-renderable reference rather than a static screenshot; no separate GitHub screenshot was acquired.

**Dirty versus selected versus focused.** VS Code's [Open Editors source](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/files/browser/views/openEditorsView.ts) explicitly tracks unsaved dirty working copies separately. Zed and Lapce additionally expose Git-aware presentation. None of this licenses an invented Git status in our tree. Here “Auki” always identifies the single open document, a focus ring identifies the button keyboard navigation will act on, and “● Muokattu” identifies the unsaved buffer. Moving focus alone does not change the open file; entering the document leaves its row marked. There is no multi-selection or independent persistent selected-file state.

## Round 2 directions and boundaries

| Direction | Hierarchy scaffolding | Wins when | Cost |
| --- | --- | --- | --- |
| **Viivasto** | Full hierarchy, interior guides, neutral document icons | Parent/child relationships matter while moving between nearby files | More visual marks and less name width than Pelkistetty |
| **Pelkistetty** | Full hierarchy, indentation and folder disclosure only | Filenames are the primary scanning target | Deep hierarchy is harder to follow across long rows |
| **Tiivistetty** | Viivasto with single-child directory chains on one row | Thin directory chains dominate | Intermediate directory names are not separate interaction targets; combined labels can get long |

All variants have the same six invented files, expanded initial hierarchy, open `src/status.ts`, source text, conversation and settings. The added `src/lib/status/format.ts` makes compaction visible without changing content between contestants. Compact folder labels are a display convention only: file identifiers remain unmodified. The active row has a **neutral `--ah-sunken` surface**, bold filename and state word; there is no inset selection shadow, pseudo-element stripe or coloured left border. The ordinary focus ring remains visible on **all four sides**, including folders, and does not indicate the open document.

The 13rem production picker becomes 15rem (240px) in all directions to leave room for filenames plus explicit status. At phone width the overlay gets a 420px scrolling body, instead of leaving almost all its height to the filter header. The document and conversation stay stacked and scrollable. Long names have ellipsis plus full accessible name/title; opening one exposes its full path in the wrapping toolbar. Buttons retain the shared token heights. Settings retains round 1's exact segmented-control structure and dimensions; its explanatory scope sentence is corrected to the actual account-backed preference that follows devices, rather than round 1's inaccurate “this browser and account”. No new preference storage is proposed.

Filtering uses the fixture's **loaded file names and paths**, not the previously navigated folder and not an unbounded recursive search. Results include their path so duplicate basenames remain distinguishable. Clearing it restores expansion state. A production implementation would filter transient loaded directory listings from existing user-daemon reads; compact chains could only be inferred from complete listings, never a truncated/unknown directory. No background recursive scan, cache, workspace registry, Git-status endpoint, new authority or new library is proposed. There are no multi-file buffers or tabs. Synthetic save succeeds immediately; existing conflict, refusal, uncertain-save, truncated/loading/error and unsupported-entry states remain implementation obligations, not things this visual experiment proves.

### Production grounding

Read current `web/src/app/EditorSettings.tsx`, `components/BrowserEditor.tsx` / `.css`, the design tokens and design/prototype instructions, and round 1 sources. Reused the **existing synthetic production captures** in [production-context](production-context/) for Settings › Editori, Settings › Ulkoasu and the actual CodeMirror picker, inspecting the editor image after AVIF decoding. These are round 1's same-day captures, **not newly run lab evidence**. The relevant current source still has the plain radio fieldset and single-directory picker. The real source, original capture provenance and round-1 result bound the context; another expensive host-lab run would not establish anything about a presentation-only riff.

Like round 1, this is an authored token-backed presentation copy: editor-left / 440px conversation-right, production header geometry, workspace/settings rails, textarea stand-in for CodeMirror. Unrelated context controls are explicitly inert. No product code or contract changed, and no real host, credentials, files or personal data went into the published page.

## Round 2 rebuild and verification

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-22-tiedostopuu-r2
node design-system/prototypes/rounds/2026-10-22-tiedostopuu-r2/publish-build.mjs
# With Playwright + cached Chromium available:
node design-system/prototypes/rounds/2026-10-22-tiedostopuu-r2/check.mjs \
  design-system/prototypes/dist/2026-10-22-tiedostopuu-r2.html evidence
node design-system/prototypes/rounds/2026-10-22-tiedostopuu-r2/check.mjs \
  https://glasspad.example.test/p/oj2sbn7anwp77qcxhxpdgjluxy/ hosted-evidence
```

- **180 offline + 180 hosted checkpoints passed**, 3 directions × 1440/1366/390px × light/dark × 10 checkpoints, zero console/page errors. Both final runs used the same final build, fresh browser contexts and cached Playwright/Chromium on Cedar in `/var/tmp/oh-filetree-r2`; only a round-local symlink reused round 1's disposable dependency. No global package/browser installation or personal profile.
- Checks cover document/control overflow, settings selection by mouse and keyboard, description changes, filtering/missing results, expand/collapse, compact versus full directory structure, long names, arrow-key focus without opening, folder left/right keys, absence of selected-row box shadow, dirty confirmation/cancel/discard, explicit save, phone overlay and buffer retention across Settings/editor surfaces.
- **23 screenshot/static-HTML pairs** in [round-2/evidence](round-2/evidence/): settings at 1440/light and 390/dark; each tree's files, edited document and dirty-tree state at those widths/themes, plus phone file scrolling. HTML snapshots are script-free and retain textarea content and expanded/dirty state; focus and scroll are screenshot evidence, not interactive HTML behaviour. Images converted to AVIF with `avifenc -j 2 -s 8 -q 75`. Other matrix dimensions are checked without retained screenshots.
- Self-review inspected Viivasto and Pelkistetty desktop/light, Tiivistetty phone/dark, phone dirty state and settings, correcting the phone overlay's usable height before both final runs. No independent-model review, product gate, fresh lab run or native filesystem/security claim.
- Hosted publication contains **only the one generated synthetic HTML page**, with embedded font faces removed to respect Glasspad's sandbox. Offline evidence retains bundled Instrument Sans and JetBrains Mono; hosted uses token fallback fonts. Published under new stable key `open-habitat-proto-editor-settings-filetree-r2`, so round 1's review link remains unchanged.

Published HTML SHA-256: `a22a67b3fd4f962b858779217b9e281913232b6f84d195719b94003111df4c92`. Build, both JS syntax checks, project-view validator and `git diff --check` passed. Issue doctor was run at the start: no schema/transition errors; existing attachment-format advisories are unrelated. Nothing was pushed.

## Round 2 failure inventory

- Initial browser check found that ArrowLeft/Right propagated from tree buttons to the shared prototype picker, resetting the variant instead of just collapsing the folder. Added a round-local propagation boundary (no shared-library edit), then repeated the full offline and hosted matrices; both final runs passed. Initial log: `/var/tmp/oh-filetree-r2/offline.log`; final logs: `offline-final.log`, `hosted-final.log` in that directory on Alder.
- The file reader does not display AVIF as an image; decoded the existing production AVIF to a temporary PNG with `avifdec` before inspecting it. Original evidence stays untouched.
- Research fetches: Zed's rendered configuration page returned HTTP 403; read its first-party raw Markdown, default settings and panel source instead. An obsolete Theia source path returned 404; the current navigator widget was retrieved. GitHub's guessed older file-finder documentation URL returned 404, and the general code-navigation/file-view docs did not substantiate tree behaviour; used the public Primer TreeView reference and explicitly limited those claims. Research is complete at the scope stated above; no missing source was silently substituted with a claimed live application observation. Downloads are under `/var/tmp/oh-filetree-r2/research/` on Alder.
- The first update to the existing round-2 Glasspad page returned `request_failed` (transport failure). One retry succeeded at the same URL, and the complete final hosted matrix then passed. Nothing private was published and no stale first-build claim is used.

---

# Round 1 · retained for comparison

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
