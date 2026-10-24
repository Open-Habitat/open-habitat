# Result

The title-dots case now unregisters all page routes in a finally block with
`behavior: "ignoreErrors"`, before fixture teardown closes the page. Snapshot
poll callbacks already in `route.fetch` may finish without leaking teardown
errors. Cleanup also runs after a failed assertion, including when a held
manual-title reply has not been released. Behavior assertions remain unchanged:
automatic pending/settled state, native title preservation, and successful and
failed manual title replies. No production behavior changed.

## Verification

Tested base `aa2a59ef` plus this run's two spec edits (2026-10-24).
`web/tests/browser-conversation.spec.ts` SHA256:
`403ba9bc6364f2180ea089807857fe2b5dd7db9d74f00c9280c41fd2f7e33a65`.

From `web/`, under `umask 077` and `TMPDIR=/var/tmp`:

```sh
npx playwright test tests/browser-conversation.spec.ts --repeat-each=10 --retries=0
```

Passed 700/700 cases, four workers, 10.7 minutes, including ten passes of the
title-dots case. Ordinary npx routing placed execution in Fleetrepo's remote warm
runner. This is host-backed synthetic browser evidence, not live-provider or
distinct-UID isolation evidence.

`npm ci --prefix web && ./scripts/test-web-fast.sh` passed formatting, lint,
TypeScript and 689 tests across 109 files. `git diff --check` passed.
The full clean gate was not run: this worker changes only two specs, and the
conductor owns the round's main-branch gate.
