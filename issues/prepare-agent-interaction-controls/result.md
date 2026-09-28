# Agent interaction controls — UI preparation

**Implementation:** `0422997` (cherry-picked from `87bb2ae` onto main after the plan-validator fix `e67f61f`). This adopts only the issue status, production UI/tests/stories, and evidence from the preserved failed run; it does not adopt its stale base or any gateway/daemon changes.

`AgentInteractionControls` under `web/src/components/` accepts explicit send and interrupt availability/result props. It has no Pi transport; missing callbacks visibly disable actions. The caller owns the draft and acknowledgement. Enter sends, Shift+Enter adds a newline, IME composition does not send. Pending and uncertain send states disable resending; acknowledgement does not claim execution, and rejection retains the draft. Interrupt has independent availability/result. Storybook renders the production component's six states with no live callback. No app, history route/timeline, backend, schema or fixture seam was changed.

## Evidence

The original worker's focused component suite (5 files, 26 tests), typecheck, lint, format, and diff check passed at `87bb2ae`. Its clean gate failed on obsolete plan assertions before reaching the remaining checks. Those assertions were corrected on main at `e67f61f`, where the clean gate passed. On this adoption branch at `622e3c1`, and again at `a999dda` (rewritten message-only to `0e4a8b6` by issue closure stamping, same tree), `PATH="$PWD/.tools/go/bin:$PATH" TMPDIR=/var/tmp/nah-agent-ui-harvest ./scripts/ci-local.sh --clean --json` exited 0 and reported `{"status":"passed","clean":true}`. That gate includes web component/unit/browser E2E/a11y, production build/Storybook, Go race/vet, plan validation, packaging and clean-tree checks. The gate is synthetic/local evidence, not a live host or native Pi integration proof.

## Limits

The tests use jsdom with synthetic timeline rerender and a synthetic host/browser regression gate, not a live Pi send, a browser demonstration of integrated controls, or persisted drafts across reloads. The component preserves a caller-controlled draft and mounted DOM focus/scroll position; per-tab persistence, command reconciliation, native ownership, virtualized replacement history and integrated visual acceptance remain with @build-agent-control. @build-history-view visual verdict is pending. No real home, credentials or deployment were touched.
