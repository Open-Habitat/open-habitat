---
created: 2026-10-19
updated: 2026-10-20
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed by an agent during a run
source_ref: taskfleet:01m59e6mdggp91pjmqavm9c6gj/observed:account-settings-key-removal
originating_run: 01m59e6mdggp91pjmqavm9c6gj
originating_run_kind: spinoff
lane: gate-health
preparation: ready
---

# account-settings browser case 'native key add … confirmed removal' fails on main

## Description

`web/tests/account-settings.spec.ts:379` ("credential settings › @account-settings native key add, suffix, provider switch and confirmed removal") fails on unmodified `main` at f0f641e2.

Observed on alder, 2026-10-19, with `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright OH_BROWSER_WORKERS=1 OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser --spec account-settings.spec.ts` in a clean detached worktree of f0f641e2: 11 passed, 1 failed. The same case failed in three further runs on the integrations-catalog-core branch (11/12 each, once two cases failed under load).

Symptom: after choosing "GPT-6.1 Sol" and polling `/api/v1/pi/models` until `default_provider` is `openai-codex`, the test clicks "Yhteydet" and then `getByRole("button", { name: "Poista avain…", exact: true })`; that click times out after 30 s (line 421), so the key-removal button is not there.

Impact: the browser suite and every clean gate that includes this spec is red on main, which hides real regressions in account settings and makes landing evidence ambiguous.

Direction: inspect the trace (`--trace on`, `./scripts/inspect-trace.sh`) to see whether the Pi credentials section still shows a stored key after the provider switch, and whether the test or the product changed (recent Yhteydet/credential changes).
