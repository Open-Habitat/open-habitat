# Result: recover the frozen view without relaxing isolation

Implemented the accepted recovery UI in Finnish and English. A refused frame
navigation or a blocked nested-frame load replaces the frame with a message and
**Reopen the view**. Recovery obtains a fresh grant through the existing open
flow; it does not replay a spent handoff or depend on a surviving view cookie.
The panel, Outputs preview and app-owned standalone page use the same fallback.
The original view's in-memory choices are not preserved.

## Decisions for later review

- **Keep the sandbox and CSP unchanged, including `frame-src 'none'` in view
  responses.** Do not enable same-view URL-backed nested frames, blob frames or
  any new frame source. A prototype should put its parts in one document rather
  than require nested page loads. Permitting those loads would expand the
  active-document surface and require a separate security decision. This task
  changes the presentation of existing refusals, not the browser's permissions.
  An attempted blocked child load replaces the whole view with recovery; reopening
  the same prototype can encounter the same refusal again.
- **Use an on-load challenge, not a perpetual heartbeat or a global parent CSP
  event.** Each iframe load gets a fresh nonce. The early injected bootstrap
  answers it and reports enforced child/frame CSP violations, retaining any
  violation that preceded the challenge. The parent accepts only its exact
  iframe window, opaque origin, current nonce and boolean status. A missing
  response after three seconds shows recovery. This identifies the particular
  frame, handles browser error documents and still allows same-bundle HTML
  navigation. A parent CSP event alone cannot identify the offending frame or
  cover destinations admitted by the parent's policy. A perpetual heartbeat
  would unnecessarily depend on background-tab timer scheduling.
- **The handshake is presentation only.** The current view can spoof or suppress
  its own status, but messages carry no content, credentials or authority and
  cannot mint a grant. Gateway session checks and browser CSP remain enforcement.
  The parent's wildcard message target is necessary for the opaque child and
  carries only the challenge; child replies target the configured app origin.
- **Keep the panel an HTML-view surface.** Navigating the frame to a non-HTML
  sibling (image, SVG, text) also gets recovery because it cannot answer the
  probe. Images and other assets embedded in HTML continue working. Likewise,
  `document.open/write/close` replacement removes the bootstrap and gets recovery;
  ordinary DOM updates and sibling HTML navigation remain supported. These are
  deliberate compatibility limits, not proof that the destination was foreign.
- **Reopen explicitly, never in a reload loop.** The owner must press the button.
  The existing open paths recheck access and mint a fresh grant, including after
  a lost view session. If app access itself has ended, existing sign-in/failure
  handling applies.

The gateway bounds initial tokenization to 64 KiB, streams the rest, preserves
ordinary doctype/UTF-8 bytes and decodes BOM-marked UTF-16 before insertion.
Frozen exports and ZIP downloads are unchanged. `x/text v0.30.0`, already selected
by pinned `x/net`, is now a direct import for its streaming decoder.

## Review and assessment

Critical independent `/llm-review`: **claude-fable-5-2** finder and
**gpt-6-astra** verifier (two successful calls). `/assess-findings` recorded four
confirmed fixes: bound tokenizer memory, reacquire lost view grants, preserve
UTF-16 meaning, and place the bootstrap before a limit-truncated comment.
The non-HTML/document-replacement cases above were assessed as product choices
and explicitly retained under the brief's delegated product authority.
No unresolved authorization finding or follow-up issue. Review/assessment
artifacts and final check logs are retained with the evidence below.

## Verification

Final implementation checked on the worker branch based on
`f1011f6239af3504bf8f51328c56815d2dc665a8`; the commits carrying this result identify
its exact source tree.

- `./scripts/test-focused.sh --area web`: **259 files, 2187 tests passed**,
  including static checks, types, catalog parity and frame-message regressions.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`:
  **passed**, including view serving/session/CSP tests and new streaming,
  oversized closed-comment and UTF-16 regressions.
- Focused Playwright: `agent-views.spec.ts`, `view-links.spec.ts`,
  `ui-language-views.spec.ts`, `--repeat-each 3`, `OH_BROWSER_WORKERS=2`,
  reply jitter 0–60 ms: **39 passed**. New cases prove external location
  navigation → recovery → fresh reopening even after deleting the view cookie,
  and a parser-time same-view nested iframe → recovery with no child request.
  Existing cases still prove HTML sibling navigation, images, sandbox denials,
  public links and standalone tabs. The fallback panel passed Axe and recovery
  receives keyboard focus.
- Synthetic visual checks: Finnish/English at 1440 and 390 CSS pixels,
  including Explain card V44 and successful recovery. Paired PNG and offline
  HTML snapshots are outside the repository at
  `/var/tmp/agent-keep/view-location-href-replaces-frame/`.
- UI-reference regeneration and `--check`, `git diff --check`, project-view
  validation and `issuectl doctor`: passed. Regeneration also repaired pre-existing
  drift in the access/storage reference files; that is a separate docs commit,
  not a change to access/storage behavior.

Early development checks caught fixture timing, test/lint wiring, and a unit
focus assertion unsuitable for fake timers; these were corrected before the
final runs. Browser focus is asserted in the real Chromium journey instead.
No full browser suite or clean gate was run. Evidence is synthetic same-UID
Chromium, not installed-server, Firefox/Safari or distinct-UID qualification.
No test-server deployment was performed.

## Live check

After deployment, open an agent view whose button assigns an external address
to `location.href`. Within roughly three seconds, the pane should offer
**Näkymä yritti avata toisen sivun / Avaa näkymä uudelleen** (or the English
counterparts). Press the button: the original frozen view, stylesheet and
scripts should load again. Repeat in its own tab and from Outputs.

Then open a prototype containing `<iframe src="part.html">`. Instead of keeping
the child's browser error page, the whole view should offer the same recovery.
The nested page remains refused; reopening does not make that prototype's
nested pages supported. Check the Explain card in both languages and confirm
that it warns that choices reset and the same refusal may recur.
