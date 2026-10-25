# Implementation and verification

Run `01m5sda3wz2tmj1z7jgagc811p` adopted only `9dfb1ff8` and `965f1720` as `f8a8384a` and `95355fd2` from the preserved branch, without merging it. The modify/delete conflict on this result file was resolved by retaining the evidence notes and replacing their obsolete execution claims here. The out-of-scope `099d7344` was not adopted; `scripts/ci-local.sh` is unchanged.

The rail uses the existing navigation-link primitive, a dot, plain Finnish count (”1 uusi vastaus” / ”N uutta vastausta”), and a forward arrow. It opens the first unread conversation; remaining replies stay marked. Compact navigation shows the count with the full accessible name. Stories and catalog preview use the production interaction. `KOKEILTAVAA.md` has the next-release Birch exercise under Uutta 25.10.

Destinations come from the full conversation catalog, independently of filtering and collapsed/finished groups. Browser-owned/resumable conversations use their workspace route, native conversations `/agents/…`; worktree sessions use the existing ownership helper. Removed and archived conversations do not inflate the count.

## Focused self-review

Reviewed the adopted production diff against current main: route ownership (`browserOwned`), metadata/catalog selection, attention clearing, filtered/collapsed rail behavior, accessible names and production story imports. No new state owner, API, daemon, dependency or contract. The existing visible/seen lifecycle clears only the opened reply. Multiple replies go to the first, leaving others marked, as permitted by the acceptance criteria. The host-backed journey checks two replies, count/name changes, keyboard activation, existing composer focus, narrow navigation and scoped axe; unit cases cover browser/native/worktree routing and stale/archived entries. No blocking finding.

## Evidence

The paired synthetic production screenshots and offline HTML adopted unchanged from `965f1720` are in `evidence/unread-{1440,390}-{light,dark}.{png,html}`. They show invented lab data, not a live installation, and are capture-only visual evidence rather than automated visual comparisons.

Current-run checks use native tools (`PATH=/usr/local/bin:/home/maintainer/.local/bin:/usr/bin:/bin`), Go 1.27.1, Node 22.23.2, and a shared scratch lease. Focused checks use `/var/tmp/agent-scratch/ru3`; the full gate receives **no TMPDIR override**, choosing its own scratch. Logs and receipts are retained under `/var/tmp/agent-keep/rail-unread-01m5sda3/`.

Focused web/browser checks and full clean gate: in progress on the committed adopted implementation; final outcomes are recorded after completion. Evidence files will not be regenerated during the gate.

## Tool/sub-workflow failures and recovery

- Reading the brief's optional `web/src/AGENTS.md` failed because it does not exist; read the actual nearest `web/AGENTS.md` and the design vocabulary instead. Exploratory glob/path checks for a navigation-named spec and `/usr/local/go/bin/go` also found no such paths; used the actual rail/shell specs and native Go on PATH. No required check was skipped.
- Cherry-picking `965f1720` stopped on the result-file modify/delete conflict; retained it, completed the cherry-pick, and rewrote stale notes here. Product files applied without conflict.
- Refreshed the older issue skill into a private evidence directory and read its matching 0.21.0 instructions; no global installation or project tooling changed.

Earlier attempts' failures are preserved in their commit histories; none are claimed as current-run passes. Non-fatal npm dependency-audit advisories are pre-existing and outside this UI change.
