# Result

The landing mark is now `design-system/favicon.svg`, linked by production HTML
(Vite emits a hashed asset) and embedded as a data URL by the prototype builder.
The existing ajv-formats dependency is registered in validators that referenced
common UUID/date-time definitions or account-session dates. No dependency or
contract changes were needed. Reconnect logs are off by default; set
`sessionStorage.setItem("oh:debug-reconnect", "true")` in DevTools to opt in for
that tab, then reload to trace startup. Removing the key disables it. Disabled
storage cannot break recovery, and the closed-field privacy policy is retained.

## Verification

Final runnable diff against base `daadaef5b7e8701e343424b2f92348ae72345728`,
including explicitly captured untracked `design-system/favicon.svg`, passed on
the shared native ARM runner:

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web --untracked design-system/favicon.svg`:
  formatting, lint, typecheck, 281 unit tests and 196 component tests passed.
  Job `32881af925dae1e604f9bf2e2a6d0c0bb688833668572a661ea0041e3f976f6b`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec reconnect-recovery.spec.ts --untracked design-system/favicon.svg`:
  10 passed. Job `33294e09d63a02b0be5e2388b5f99bbf1f3ac0fe9443f718080ff3907185637a`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec loading-landing.spec.ts --untracked design-system/favicon.svg`:
  4 passed, including served SVG content type and completely quiet authenticated
  reload. Job `ed6c08205a1948c197b75be566fcbb3d09c44246905d97b68a72ad14f2968d00`.
- `node design-system/prototypes/build.mjs design-system/prototypes/agentin-vuoro --out /var/tmp/favicon-prototype.html`
  and the equivalent `etusivu` build passed. XML parsing and base64 decoding
  confirmed both outputs embed exactly the canonical SVG bytes.
- `git diff --check` passed. Issue metadata checked with `issuectl doctor --json`.

Browser evidence is host-backed synthetic behavior, not distinct-UID or live
server evidence. Before/after captures and prototype visual exploration were
deferred under Alder's no-local-lab/capture policy. No full gate, live-server
changes, push or deployment was performed. Deployment belongs to the conductor.

## Review and failure inventory

Focused self-review was proportionate: the diff changes a static icon, browser
format registration and logging opt-in, not Unix-user isolation, component
authority or installation hardening. Checked asset resolution in the production
browser build, standalone prototype portability, disabled-storage behavior,
format rejection, and preservation of diagnostic privacy coverage.

Earlier attempts failed and were corrected: one test quote failed formatting;
the first console test included intentional unauthenticated 401s, so observation
now starts at the authenticated reload; existing diagnostic tests needed explicit
opt-in. The first landing timing run measured 475.6 ms against an existing 480 ms
threshold; it passed unchanged on both later runs. No failing checks remain.
Initial discovery probes guessed absent files/globs (the existing diagnostic
and history tests use `.tsx`); the actual files were then found and used. One
attempt to parse the bounded runner-log display as JSON failed because the display
was truncated; retained raw JSON supplied the complete evidence instead.
`issuectl ready` initially reported missing acceptance criteria; criteria are now
recorded above. No optional review or tool failure affects delivery.
