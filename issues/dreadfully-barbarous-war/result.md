# Result

History reads no longer queue the conversation stream. Events advance the live cursor in order, including frames for other conversations. Native entries arriving during a read overlay its pages so stale page content cannot replace newer entries; recovery crossing a read schedules one follow-up after the complete page range joins.

## Review

One focused independent review by `claude-fable-5-1` found that newly streamed appends could falsely witness a join (or make a legitimate join look noncontiguous). Confirmed against the join code and fixed: appended entries remain visible but do not become join witnesses until the read ends. Updates to keys already held remain valid witnesses. Added the review's one-page, disjoint-tail and multi-page repros; all pass. The reviewer also checked nested read ownership, cancellation/reseeding and live-fragment preservation. No unresolved finding remains.

The initial review command had an argument-shape error before invoking a model; the corrected invocation succeeded. Fresh-checkout missing dependencies were installed before tests. Details: `/var/tmp/dread-tool-failures.log` (local scratch).

## Verification

Synthetic evidence for the worker's code diff (commit identified by `Fixes-Issue: dreadfully-barbarous-war`):

- `npx vitest run src/app/conversationStore.test.tsx`: 48 tests passed, 1.01 s. Covers live text/tool progress during catch-up, unrelated-conversation sequence advancement, saved-entry replacement and append during tail/older/reconnect reads and read failure, nested recovery ownership, and streamed appends appearing in overlapping/disjoint/multi-page native reads.
- `./scripts/test-web-fast.sh`: final run passed, 42.49 s (format, lint, TypeScript, 485 unit/component tests).
- `cd web && npx playwright test --config playwright.lab.config.ts tests/lab-long-stream.spec.ts tests/lab-live-turn.spec.ts`: final run 2 passed, 74.38 s wall / 19.6 s Playwright. With 1.2 s history and 1.7 s snapshot latency, longest sampled live-text stall was **75 ms**; no gap/recovery/stale warning, shrinking text or editor movement. Tightened the previous 2 s allowance to 600 ms.
- `cd web && npx playwright test tests/native-history.spec.ts tests/browser-conversation.spec.ts`: final run 78 passed, 52.82 s wall / 34.0 s Playwright.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed.

Commands used `TMPDIR=/var/tmp`; browser checks used `umask 077` and the installed command routing to Cedar. No Go, contracts or packaging source changed; no full gate run. These are synthetic host/browser results, not live-provider or distinct-UID evidence. Test-server deployment remains with the conductor.
