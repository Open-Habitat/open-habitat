# Result

The first automatic recap now obeys the same draft hold as later recaps. Already displayed recaps stay visible; explicitly requesting a recap can still reveal it. The existing presentation state was extracted into `useRecapPresentationHold` so fake-timer tests exercise the production decision together with `useRecapHold`, not a test copy.

## Evidence

Tested on Birch from base `cc6bdf94` with this issue's diff. Go/browser commands used umask 077, disk-backed `/var/tmp` scratch, two browser workers and `OH_PORT_BASE=11400`.

- Reproduction before the fix: `cd web && npx vitest run src/app/recapHold.test.tsx` failed at the five-minute draft-hold assertion (expected held, received false); the already-visible ordering passed.
- Browser reproduction before the fix: `./scripts/test-focused.sh --area browser --spec lab-conversation.spec.ts --tag 'long message'`: existing-conversation variant passed, first-read variant failed after five simulated minutes (one recap card instead of zero).
- Final `./scripts/test-focused.sh --area web`: static checks, typecheck and all 168 test files / 1258 tests passed. Includes first-read hold, already-visible retention and explicit reveal tests with fake timers.
- Final `./scripts/test-focused.sh --area browser --spec lab-conversation.spec.ts`: all 15 cases passed, including both long-message delivery orders. Existing assertions still require a nonempty draft, continued hiding after five minutes, and reveal only after clearing and pausing.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check` passed (doctor reports existing image-format advisories).
- An intermediate web check caught a missed `setRecapSeen` call in the header action during extraction. It now calls the hook's explicit `reveal`; the added fast test and full named browser spec pass.

Browser evidence is host-backed synthetic evidence using the real controller with fake Pi, not live provider, installed-host or distinct-UID evidence. No daemon, contract, session-store or authority change; no full gate or whole browser suite run.

## Focused self-review

Reviewed the extraction against every old `recapSeen` use, fingerprint/key scoping, explicit-request bypass, the first-reply ordering and retained browser assertions. The only automatic presentation policy change is that an unseen recap respects the draft even after recent input expires. Dismissal, recap generation, transport and presence reporting remain unchanged.

## Decisions for later review

- A draft already present on opening also holds an unseen automatic recap, even without recent keystrokes. Alternative: exempt restored drafts. Chosen because an unsent message still represents unfinished composition; exempting it would restore timing-dependent interruptions. An already displayed recap is still retained, and the explicit header action still reveals it.
