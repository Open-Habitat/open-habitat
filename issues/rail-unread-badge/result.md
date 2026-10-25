# Implementation and verification

Run `01m5sda3wz2tmj1z7jgagc811p` adopted only `9dfb1ff8` and `965f1720` as `f8a8384a` and `95355fd2` from the preserved branch, without merging it. The modify/delete conflict on this result file was resolved by retaining the evidence notes and replacing their obsolete execution claims here. The out-of-scope `099d7344` was not adopted; `scripts/ci-local.sh` is unchanged.

The rail uses the existing navigation-link primitive, a dot, plain Finnish count (”1 uusi vastaus” / ”N uutta vastausta”), and a forward arrow. It opens the first unread conversation; remaining replies stay marked. Compact navigation shows the count with the full accessible name. Stories and catalog preview use the production interaction. `KOKEILTAVAA.md` has the next-release Birch exercise under Uutta 25.10.

Destinations come from the full conversation catalog, independently of filtering and collapsed/finished groups. Browser-owned/resumable conversations use their workspace route, native conversations `/agents/…`; worktree sessions use the existing ownership helper. Removed and archived conversations do not inflate the count.

## Focused self-review

Reviewed the adopted production diff against current main: route ownership (`browserOwned`), metadata/catalog selection, attention clearing, filtered/collapsed rail behavior, accessible names and production story imports. No new state owner, API, daemon, dependency or contract. The existing visible/seen lifecycle clears only the opened reply. Multiple replies go to the first, leaving others marked, as permitted by the acceptance criteria. The host-backed journey checks two replies, count/name changes, keyboard activation, existing composer focus, narrow navigation and scoped axe; unit cases cover browser/native/worktree routing and stale/archived entries. No blocking finding.

## Evidence

The paired synthetic production screenshots and offline HTML adopted unchanged from `965f1720` are in `evidence/unread-{1440,390}-{light,dark}.{png,html}`. They show invented lab data, not a live installation, and are capture-only visual evidence rather than automated visual comparisons.

Current-run checks use native tools (`PATH=/usr/local/bin:/home/maintainer/.local/bin:/usr/bin:/bin`), Go 1.27.1, Node 22.23.2, and a shared scratch lease. Focused checks use `/var/tmp/agent-scratch/ru3`; the full gate receives **no TMPDIR override**, choosing its own scratch. Logs and receipts are retained under `/var/tmp/agent-keep/rail-unread-01m5sda3/`.

At commit `47076eacd6545edc62b881df05c7cbf20882cd1a`, tree `0bf1d823cdb37525ce8b413da0606ab3727f8b67`:

- `npm ci --prefix web && ./scripts/test-web-fast.sh`: passed formatting, lint, TypeScript, 118 Vitest files / 747 tests (`web-fast.log`).
- From `web/`, `npx playwright test tests/rail-unread.spec.ts tests/shell-accessibility.spec.ts`, `OH_PORT_BASE=25100 OH_BROWSER_WORKERS=2`: all four host-backed synthetic cases passed, including keyboard, focus, narrow rail and scoped axe checks (`browser.log`).
- Exact required full gate `flock --shared /var/tmp/agent-scratch/.lease ./scripts/ci-local.sh --clean --json`, no TMPDIR override: **failed** after 1237 seconds, exit 2 (`gate.log`). Go/contracts passed. Ordinary browser: 372 passed, 3 skipped, 3 failed. Lab: 127 passed, 4 failed. No clean-gate receipt and no live-host acceptance claimed.
- Failed ordinary cases: clone-page interrupted clone and interrupted Gitea clone (expected `/workspaces`, stayed `/workspaces/new`), single-workspace frame-count transition (click timeout). Failed lab cases: idle conversations capacity/deletion, running-turn capacity/deletion, workspace delete/undo/restore/purge/empty, worktree cleanup. These are outside the adopted production diff; no flake claim is made from one run.
- Additionally, unrelated lab cases **unconditionally regenerated source-tree evidence during the gate**, despite starting with a clean tree and no capture invocation by this worker. Final `git diff --check` failed on the generated HTML. The unconditional writes are in `lab-browser-editor.spec.ts`, `lab-title-generation.spec.ts`, and `lab-integration-trash.spec.ts`. Filed the observed blocker as @awfully-bawdy-jar via intake, born unlaned/untriaged with this exact run's provenance.

The generated evidence was preserved as `gate-generated-evidence.tar.gz` with an exact `gate-generated-files.txt` manifest in the log directory, then only those gate-generated changes were restored/removed. The unread issue's adopted evidence was not regenerated. Because the failure was **not only browser/lab assertions** (the gate also violated its clean-tree invariant), the brief's browser-only three-isolated-reruns/second-gate fallback was not invoked. Fixing unrelated test capture behavior is outside this UI brief; the gate script remains unchanged. Required full-gate verification is incomplete, so this attempt is blocked, the issue is not closed and no merge is requested.

## Tool/sub-workflow failures and recovery

- Reading the brief's optional `web/src/AGENTS.md` failed because it does not exist; read the actual nearest `web/AGENTS.md` and the design vocabulary instead. Exploratory glob/path checks for a navigation-named spec and `/usr/local/go/bin/go` also found no such paths; used the actual rail/shell specs and native Go on PATH. No required check was skipped.
- Cherry-picking `965f1720` stopped on the result-file modify/delete conflict; retained it, completed the cherry-pick, and rewrote stale notes here. Product files applied without conflict.
- Refreshed the older issue skill into a private evidence directory and read its matching 0.21.0 instructions; no global installation or project tooling changed.
- The required clean gate failed on seven unrelated browser/lab cases and generated evidence whitespace/source-tree mutation, as detailed above. One full attempt; no retries or success claim. Preserved generated bytes before restoring the checkout. This mandatory failure blocks merging; reporting failure preserves all committed work for the caller.

Earlier attempts' failures are preserved in their commit histories; none are claimed as current-run passes. Non-fatal npm dependency-audit advisories are pre-existing and outside this UI change.
