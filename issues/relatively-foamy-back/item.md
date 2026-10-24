---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: gate run in taskfleet worker
source_ref: taskfleet:01m5phrd9kn11x3wa2mz8qcdqk/gate-flake:start-here-focus
originating_run: 01m5phrd9kn11x3wa2mz8qcdqk
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-24
---

# Gate flake: start-here 390 dark loses composer focus after the safe draft

## Description

Observed once in the full gate (`./scripts/ci-local.sh --clean --json`, 2026-10-24,
branch of `stop-turn-flicker`, which does not touch the start page):

`tests/start-here.spec.ts:8` "@lab @a11y authored start page and safe draft 390 dark"
failed at line 130, `await expect(field).toBeFocused()` on `message-input`: the
field held the expected start-page draft but was not focused within 5 s
("inactive"). The same case passed 8/8 when rerun alone (default and repeat-each 4).

Likely a focus race under the gate's parallel load. It makes the gate red
without a product change, so the gate needs a rerun.

## Comments

### 2026-10-24T09:26:26Z · @agent

Not width-specific: the same assertion (start-here.spec.ts:149, message-input not focused after guide-start-bottom) failed once at 1440 light in the cloud-sync-status-truth gate the same day, with the field still holding the previous guide text (/skill:pytest-debug), i.e. the click's insertion had not landed. It passed 4/4 in three reruns on that tree.

## Acceptance Criteria

- [x] Draft focus and placeholder selection follow the committed controlled value, not a single animation frame.
- [x] The authored-page journey waits for the durable conversation before interacting and reloading.
- [x] All four viewport/theme cases pass ten repetitions without retries.

## Result

Two independent timing assumptions were reachable. `StartPageRead` called
`onChange` and scheduled one animation frame, then silently skipped focus and
selection when the textarea still held the previous draft. React can commit the
controlled value after that frame. Focus/selection now run in a layout effect
when the prepared draft is committed. A deterministic delayed-parent-commit
regression fails against the original implementation (focus remains on the
guide heading), passes against the fix, and verifies later typing does not
steal focus back.

The browser journey also interacted with the start page while the conversation
was still being created. That page is intentionally usable immediately, but the
creation-to-native-conversation handoff replaces its composer. The journey now
waits for `?conversation=pi:` before its focus assertions and reloads. This is a
real completion condition, not a sleep or longer assertion timeout. Lazy
Markdown is not involved in the guide action.

## Tests Run

Tested changes atop `792c13340ea7523210e81db85d0930cfe7bb235c`, with the
implementation, regression and browser-spec bytes in this fix commit.

- [x] `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: format, lint,
  typecheck and all 104 Vitest files / 644 tests passed (final run).
- [x] `cd web && TMPDIR=/var/tmp npx vitest run src/app/StartPageRead.test.tsx`:
  8 passed after the original-code countercheck failed at the new focus assertion.
- [x] `cd web && TMPDIR=/var/tmp npx playwright test tests/start-here.spec.ts --repeat-each=10 --workers=4`:
  final run 40/40 passed, no retries, including axe checks, via the declared
  Cedar warm runner (116 seconds including setup/transport).
- [x] `git diff --check`; `issuectl doctor --json`.

The first completed browser repetition run passed all focus checks but finished
39/40: one reload during creation returned to the workspace page instead of
showing the mocked needs-update page. Its error context confirmed the workspace
route; the durable-route waits above address this same journey's second race.
The first web attempt lacked dependencies; `npm ci --prefix web` resolved it.
The initial browser attempt was blocked by a stale execution-runner SSH pin.
The observed new ED25519 fingerprint was independently verified through
Cedar's Lima guest console, then the exact pin was refreshed with its old
value backed up at `/var/tmp/start-focus-known-hosts-before`.

This is host-backed synthetic browser/focus and accessibility evidence, not
Linux UID isolation, live-provider or full-clean-gate evidence. No full gate
was run, per the worker landing policy. No push was made.
