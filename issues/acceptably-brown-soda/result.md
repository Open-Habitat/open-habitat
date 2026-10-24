# Result

The response waiter now consumes JSON immediately when the create reply arrives,
and awaits that result before later navigation assertions or reload. The test
retains its startup deadline, starting-state, usable composer, stable selected
native identity after reload, and single-POST assertions on all three surfaces.
No production behavior changed.

## Verification

Tested base `aa2a59ef` plus this run's two spec edits (2026-10-24).
`web/tests/lab-slow-creation.spec.ts` SHA256:
`b6e1874f8e40f2ce37b595bf40f9c0ba2de16dce3b5d94da7e2ae9eb01a8df20`.

From `web/`, under `umask 077` and `TMPDIR=/var/tmp`:

```sh
npx playwright test --config playwright.lab.config.ts tests/lab-slow-creation.spec.ts --repeat-each=10 --retries=0
```

Passed 30/30 cases, four workers, 28.9 seconds. Ordinary npx routing placed
execution in Fleetrepo's remote warm runner. This is host-backed synthetic
browser evidence, not live-provider or distinct-UID isolation evidence.

`npm ci --prefix web && ./scripts/test-web-fast.sh` passed formatting, lint,
TypeScript and 689 tests across 109 files. `git diff --check` passed.
The full clean gate was not run: this worker changes only two specs, and the
conductor owns the round's main-branch gate.
