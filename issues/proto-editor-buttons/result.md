# Editor controls: prototype round

Review link: https://glasspad.example.test/p/aeex4uefjc42mhrkrvgwfhvyu4/

## Choice for Jari

Axis: **where editor visibility and full-window controls belong**. All directions use the same invented workspace, conversation, file and draft. No direction is selected; the issue remains open. Production implementation is separate.

1. **Näkymäpalkki**: open/close and full-window/restore live together in a persistent workspace-wide top bar. Stable location, but pane-specific controls occupy global chrome.
2. **Oma otsake** — recommended: open from the top bar; full-window/restore and close sit at the editor's top-right edge. The action is adjacent to the pane it changes and stays visible in full-window mode. The global editor toggle stays highlighted and can also close it.
3. **Näkymät**: a persistent three-way view selector (Keskustelu / Rinnakkain / Editori) replaces the two separate controls. Explicit destinations and symmetric return, but introduces a larger view-switching concept and spends more header space.

Kokeile: avaa editori, suurenna ja palauta. Kokeile myös keskustelun tiedostolinkkiä ja koko ikkunan keskusteluliuskaa. Tuntuuko **Oma otsake** luontevalta, vai haluatko kaikkien näkymätoimintojen pysyvän yhdessä yläpalkissa? Ovatko puhelimen allekkain olevat paneelit riittävän selkeät?

## Context and scope

Read `WorkspaceEditor.tsx` (`EditorHeaderControls`), `EditorSplit.tsx` / `.css`, production geometry tokens, design guidance and the production-sized bash round. Today's controls are in the conversation header, including the action that hides that same header. This round moves that ownership visibly without changing product code.

The prototype is a round-local HTML presentation copy, not React or an embedded VS Code instance. It preserves the production editor-left/conversation-right arrangement, 296px closed-state navigation rail, rail hidden when the editor opens, a 460px conversation column, production colour/spacing/type tokens and the 40px full-window conversation strip. The single axis is control placement; the editor's tree and code are deliberately simplified context. Full-window means the editor uses the app workspace, not the browser Fullscreen API. The strip remains as a return affordance, as in production.

At 390px the split is stacked (editor above conversation); full-window becomes one editor with a bottom return strip. This is a proposed phone adaptation, not a claim about current product support. The phone checkbox gives an embedded 390px preview; real 390px browser viewports were tested too. Both themes are selectable. Unrelated navigation, model and send controls are contextual or disabled. Draft text survives open, full, restore, close and file-link transitions within a direction; switching directions resets the fixture.

No host services, stores, identity claims or new facts are assumed. Only the existing editor-open/conversation-hidden state, workspace label and Pi status are represented. All text, paths, source code and counts are invented; no process executes, no network request is initiated by the prototype, and only the authored page was published. No production, contract or installation files changed.

## Build and evidence

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-21-editorin-painikkeet
node design-system/prototypes/rounds/2026-10-21-editorin-painikkeet/publish-build.mjs
# On a browser-capable machine with playwright, without a running product host:
node check.mjs 2026-10-21-editorin-painikkeet.html evidence
```

`check.mjs` lives with the round. It was executed on Cedar in disposable `/var/tmp/oh-proto-editor-01m5ejd4`, Playwright 1.58.2 with cached Chromium 1234; no persistent package installation or live profile. Alder's no-local-specialist policy was respected. A production lab capture was not run: this is an isolated synthetic presentation experiment, not production integration evidence.

Final browser result: **126 state checks passed**, three directions × 1440/1366/390px × light/dark × seven transition checkpoints. Checks cover keyboard opening, split/full/closed, both return paths, draft retention, file-link opening, document/control overflow and desktop pane ordering. Zero console/page errors. Six PNG + adjacent script-free static HTML snapshots are in `evidence/`: each direction at desktop/light/split and phone/dark/full. The snapshots preserve the captured state when opened offline. Self-reviewed desktop and phone screenshots, focus, escape paths, narrow layout and synthetic-only publication. No independent review or full product gate was required or claimed.

Project-view validation, issue doctor, JS syntax checks, prototype build and `git diff --check` passed. Hosted smoke validation exercises all three directions through closed → split → full → strip return; **passed**, zero console/page errors (`/var/tmp/proto-editor-hosted-final.log`).

## Failure inventory and hosting limitation

- Initial browser check used an unscoped textarea locator and matched the hidden legacy composer too. Scoped it to `.e-demo`; corrected and final runs passed. Logs: `/var/tmp/proto-editor-browser.log`, `/var/tmp/proto-editor-browser-corrected.log`, `/var/tmp/proto-editor-browser-final.log` on Alder.
- First hosted smoke found font-asset CORS errors: Glasspad's null-origin iframe cannot load its same-host font assets without CORS headers. Inline fonts are also blocked by its CSP, as earlier rounds document. Rebuilt the hosted version without `@font-face`, retaining the token fallback font stacks and an explicit Finnish note. Republished at the same URL. Offline screenshots/HTML retain Instrument Sans and JetBrains Mono. This is an intentional hosting limitation, not a production font change. Logs: `/var/tmp/proto-editor-hosted.log` and `/var/tmp/proto-editor-hosted-final.log`. Control-placement comparison remains usable; exact production typography is in the offline evidence.
- A discovery `ls` glob for TopBar components had no match; the actual controls were found in `web/src/app/WorkspaceEditor.tsx`. No required input remained missing.
- No missing required review, build or browser step remains. No server access, deployment or production integration verification is claimed.

Published HTML SHA-256: `ef858cb51bf9b49bc323b60c109142ef5e644ed07850321bde5a88fbb571abcf`. `publish-build.mjs` creates the complete synthetic-only space and applies the documented hosted font fallback. Publish with the stable space key `open-habitat-proto-editor-buttons` to retain the link.
