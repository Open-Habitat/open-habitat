# Result

- `routes` Proxy replaced with `providerRoute(provider)`, which resolves only
  own keys of the provider marks (`Object.hasOwn`). Reproduced before the fix
  by loading `DefaultModelRow.tsx` on a Vite dev server in Chromium (pageerror
  and Vite's `[Unhandled error]` line); none after. Unit test
  `web/src/components/ModelField.test.ts` covers inherited names.
- `start-here.spec.ts` waits for every finite animation and transition before
  both axe audits. 4 cases × 5 repeats passed; the 390 light failure did not
  reproduce locally, not even under synthetic CPU load.

## Decisions for later review

- **Contrast treated as a test-timing issue, not a token change.** The
  reported #71767c is exactly `--ah-ink-2` at about 72 % opacity over
  `--ah-bg`, and the settled heading paints #3d434b (about 9.6:1) with nothing
  over it, so changing the token would not have fixed anything. The test waits
  for the settled view rather than switching to reduced motion, because
  reduced motion would audit a different stylesheet from the one people see.
  I could not identify which fade was running; candidates are the frame's
  landing entry and a `WarningBanner` appear under gate load.
- **No browser-level regression guard for the Refresh error.** Host-backed
  specs serve the production build, where React Refresh does not run. The
  plugin-react refresh runtime is not an exported module, so a unit test that
  called it would import a private path. The unit test pins the inherited-name
  behaviour instead.
