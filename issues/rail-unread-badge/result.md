# Implementation and verification

Adopted implementation `c34aaa47` and previous evidence `162606a7` onto current main as `9dfb1ff8` / `8cb2abad`; the old branch was not merged. The earlier placement blocker is resolved by running the native tools locally on Alder.

The rail uses the existing navigation-link primitive, a dot, plain Finnish count (”1 uusi vastaus” / ”N uutta vastausta”), and a forward arrow. It opens the first unread conversation; remaining replies stay marked. Compact navigation shows the count with the full accessible name. Stories and catalog preview use the production interaction.

Destinations come from the full conversation catalog, independently of filtering and collapsed/finished groups. Browser-owned/resumable conversations use their workspace route, native conversations `/agents/…`; worktree sessions use the existing ownership helper. Removed and archived conversations do not inflate the count.

## Focused self-review

Reviewed the production diff, route ownership, attention clearing, filtered/collapsed rail behavior and production story imports. No new state owner, API, daemon or contract. Opening still clears attention through the existing visible/seen lifecycle. The browser journey checks two replies, count/name changes, keyboard activation, editor focus, narrow navigation and a scoped axe audit. Its original heading-focus assertion was wrong: the existing conversation composer intentionally takes focus. Corrected the assertion to check that editor rather than change production focus behavior.

## Evidence

Native Alder checks, using `PATH=/usr/local/bin:/home/maintainer/.local/bin:/usr/bin:/bin`, `TMPDIR=/var/tmp/agent-scratch/rail-unread-01m5sarqa0`, `umask 077`, and a shared `/var/tmp/agent-scratch/.lease`:

- `./scripts/test-web-fast.sh`: formatting, lint, TypeScript and all 118 Vitest files / 747 tests passed.
- From `web/`, `npx playwright test tests/rail-unread.spec.ts tests/shell-accessibility.spec.ts`, `OH_PORT_BASE=24100 OH_BROWSER_WORKERS=2`: all four host-backed synthetic cases passed, including axe audits and desktop/narrow keyboard/focus checks.
- `node web/lab/rail-unread.mjs`: paired synthetic production screenshots and offline HTML in `evidence/unread-{1440,390}-{light,dark}.{png,html}`. Capture waits for theme transitions to settle. These are human-reviewed screenshots, not automated visual comparisons or live-host evidence.
- `git diff --check`, `bash -n scripts/ci-local.sh`, project-view validator and `issuectl doctor --json` checked. The gate now respects a supplied TMPDIR instead of overriding the leased scratch directory.

Full clean gate: pending on this committed tree; recorded below when complete. No runnable product code changed after the native browser and unit checks; subsequent changes are capture tooling, evidence and issue metadata.

Logs retained on Alder under `/var/tmp/agent-keep/rail-unread-01m5sarqa0/`.

## Tool/sub-workflow failures and recovery

- Initial exploratory reads of nonexistent `web/src/AGENTS.md` / `web/src/components/AGENTS.md`, a guessed process-skill path, guessed focus/composer/theme paths and a not-yet-created test-results directory failed. Used the actual nearest instructions, process skill and source paths. One malformed edit call was rejected without writing, then corrected. Combined exploratory shell commands returned nonzero for those absent paths; no required evidence depends on them.
- The installed npm/npx wrappers unexpectedly routed the first checks to a remote warm checkout. That browser run passed three cases and failed the new journey's incorrect heading-focus expectation. Corrected it to editor focus, then reran all four cases locally with native tool paths. `browser.log` preserves the initial failure; `browser-native.log` and `web-fast-native.log` preserve the passing local checks.
- Formatting the capture script from repository root failed on nested Biome configurations. Repeated from `web/`, as its instructions require.
- First lab capture used the ordinary test workspace ID, absent from the richer lab catalog, and timed out. Changed to the lab's invented aurinkokello project and reran successfully (`visual.log`, `visual-retry.log`). Initial screenshots caught intermediate theme transitions; the final capture waits for animations before taking paired evidence (`visual-settled.log`). The first transition wait rejected a cancelled CSS animation (`AbortError`, `visual-final.log`); capture now waits with `Promise.allSettled` so harmless cancellations are not treated as product errors.
- Non-fatal warnings: npm reports eight dependency audit advisories; jsdom lacks canvas support; Vite reports large chunks and the existing PostCSS `from` warning. None failed the affected checks. Repository-wide issue doctor reports existing attachment-format advisories, not schema errors.

The previous attempt's failures remain documented in commit `162606a7`; no previous blocked check is claimed as passed evidence here.
