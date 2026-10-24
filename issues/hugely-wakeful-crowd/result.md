# Result

## Verdicts

- **gofmt drift** (`dropbox_linux.go`, `google_linux.go`,
  `integrations_linux_test.go`): formatted; no behaviour change.
- **`lab-outage-account` pi-onboarding cases — test was wrong.** The
  Kartta route frame (`onboarding-route-map`, 6082e4fe) intentionally
  renders the route as a `<nav>` landmark. The assertion meant "no workspace
  rail during onboarding", so it now checks for `workspace-navigation`
  instead of any navigation landmark.
- **`lab-english-url-paths` — test was wrong.** Settings › Käyttöönotto
  (`onboarding-config-store`, 44cee473) added the intended English slug
  `/settings/onboarding` between Palvelin and Käyttäjät; the spec's
  independent vocabulary lacked it. The gateway's return-path allowlist
  already covers every `/settings/*` path.
- **`lab-conversation` slow turn — product regression.** The stop
  button's own surface was transparent (contrast 1 against the page).
  80f209f9 (`model-picker-declutter`) narrowed the composer row's button
  reset to `.ah-crow button:not(.ah-button)`, which raised its specificity
  to (0,2,1), above `.ah-crow .ah-crow-stop` and `.ah-crow .ah-crow-send`
  (0,2,0). Both Stop and Send therefore lost their filled surfaces in the
  Rivillä composer. Fixed with `:where(:not(.ah-button))`, which keeps the
  exclusion at the old (0,1,1) specificity. Not caused by the turn summary
  or attachment-chip changes.

## Checks

- The three specs pass with `./scripts/test-focused.sh --area browser --lab
  --spec <spec>` (5, 1 and 12 cases).
- Full clean gate (`./scripts/ci-local.sh --clean --json`) on the tree of
  caa48b08:
  - run 1 (on 71a7294b): every heavy phase passed; final check failed only
    because I had edited this file and KOKEILTAVAA.md while it ran;
  - run 2: Go/contracts and the ordinary browser suite passed;
    `lab-browser-editor.spec.ts:9` 390 light/dark failed with a strict-mode
    clash (`main.go` matched both `cmd/main.go` and the root file). The
    spec passed alone twice, so this is the load flake the issue already
    named; filed as `singularly-habitual-kitten`, not chased;
  - run 3: green, receipt
    `a9f76f49609cab5aa58bff0a96587e857435277a.json`.
- `start-here.spec.ts` did not fail in these runs.
