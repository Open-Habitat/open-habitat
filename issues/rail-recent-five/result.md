# Result: Recent conversations in the rail

Implemented direction 2 with a per-person count in account preferences. Recent sits below Käynnissä, keeps the newest eligible conversations by native `changed_at`, and keeps an open older eligible conversation in addition to the count (italic). The quiet folds are removed. The setting is in Appearance, searchable in Finnish and English, and follows the existing identity/CSRF-scoped preferences path.

## Decisions for later review

| Choice | Alternatives | Why |
|---|---|---|
| **Viimeisimmät / Recent** | Finished, history, time-window label | The issue's default: names recency without implying a time cutoff. |
| **Default 5; integer range 1–20** | Zero to hide it, unbounded, fixed preset choices | Five is the accepted direction; one is useful on small screens, twenty allows a longer working list without an unbounded rail. The open eligible conversation can add one row. |
| **Terminal-run conversations included** | Browser conversations only | The issue's default: native work remains reachable regardless of how it was started. |
| **Finished worktree conversations excluded, merged or not** | Exclude only known Taskfleet workers, or only merged places | Follows the prototype's `worktree_id` exclusion. Important consequence for review: ordinary browser-created worktrees are also excluded. The snapshot already omits known Taskfleet-owned places; it carries no worker boolean on remaining agents. Worktree conversations remain available on the workspace page and remain in Yours/Running while active. |
| **No Recent in the narrow dot strip** | Add five dots | The issue's default: keep that strip for attention and ongoing work beside the editor. |
| **Selected exception does not override archive or worktree exclusions** | Always show any selected history | Matches the prototype's eligible-pool rule; archiving must remove a conversation from the rail. |
| **Missing timestamps sort last; ties use agent id** | Drop unknown timestamps, or use unstable catalog order | Keep histories reachable without inventing dates; ties do not reorder on a refresh. |
| **No experimental switch** | Off by default under Experiments | This is Jari's explicit selected replacement for the existing rail behavior, not a new unapproved experiment. Workspace icons retain their existing switch. |

`changed_at` is the native file's last change, including recap/title writes, not last visit. No browser history store or new host inventory was added. Groups without icons follow their newest row; iconed rows form one flat newest-first list.

## Evidence and limits

Verified on Birch with synthetic data, `umask 077`, disk-backed TMPDIR, `OH_PORT_BASE=9870`, `OH_BROWSER_WORKERS=2`. The implementation starts from `c4b97d6d`, then rebased cleanly onto `01e110f6` (including the parallel next-waiting change). Post-rebase checks ran on `45c158a9`; the final amendment changes only this evidence narrative. `git range-diff` showed the replayed implementation unchanged.

- `./scripts/test-focused.sh --area web`: passed, 162 files / 1191 tests, lint and typecheck. Rail unit coverage includes count limits, selected overflow, archive/worktree exclusions, terminal history, and idle/restart stability.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed. Tests cover default 5, 1/20 accepted, invalid/null/fractional/string/case-variant and multi-field writes refused, and preservation across independent preference changes.
- `./scripts/test-focused.sh --area contracts`: passed; generated fingerprints regenerated. Negative fixtures now derive from the valid example, preventing the new required field from making unrelated rejection tests vacuous.
- `./scripts/test-focused.sh --area browser --spec rail-groups.spec.ts`: 2 passed; old active rows never fold, desktop/phone row geometry and axe, error-turn behavior preserved.
- `./scripts/test-focused.sh --area browser --spec rail-icons-quiet.spec.ts`: replaced its obsolete quiet-fold journey with Recent. The capture run passed both cases in lab mode: selected overflow, narrow strip exclusion, archive/worktree exclusion and newest-first grouping through a validated snapshot seam; icons on/off and phone/desktop axe; count save/reload/new-page persistence and settings search; real daemon/fake Pi send → finish → idle stop → restart → archive.
- After rebase: web passed again (161 files / 1184 tests, reflecting main's next-waiting test replacement); daemon package passed again. `./scripts/test-focused.sh --area browser --tag '@rail-recent|@rail-groups|@rail-now|@rail-interrupted-turn|@rail-running-after-done|@settings-search|@workspace-count'`: **14 passed** on the ordinary synthetic host, including one-workspace and interrupted-turn regressions.
- `python3 scripts/validate-project-view.py` and `git diff HEAD~1 HEAD --check`: passed. Captured HTML's generated trailing whitespace was normalized without changing its content.
- `issuectl doctor --json`: no metadata drift, broken references or conflicts; existing `flat/decisions-review-31-10` lacks item.md and the repository has PNG-format advisories (including these requested PNG captures). No unrelated issue directories were changed.

The old folding assertions were replaced, not silently dropped: their purpose was enforcing a behavior this issue removes. Row geometry, age, error state, workspace icons, and icon-card actions retain coverage. Capture-only images are review material, not visual-diff assertions. The wire-seam case proves rendering/exclusions, not real Taskfleet discovery. The native lifecycle case is host-backed same-UID synthetic evidence, not provider/live-host or Unix-user isolation evidence. No whole browser suite or clean gate was run.

Independent `/llm-review` used **claude-fable-5-1**, then **gpt-6-astra** to refute its one surviving fixture finding. `/assess-findings`: CONFIRMED / OCCASIONAL / IMPROVES / NONE → FIX. Fixed here; no follow-up issue. Local reports: `history/review-rail-recent-five.md` and `history/assessment-rail-recent-five.{json,md}` (scratch); the substantive result is recorded above. Model assessment logged on Alder.

### Screenshots (2×) and static HTML

All captures are from the synthetic lab with invented conversations. PNG and HTML have the same basename under `evidence/`.

| Layout | Icons off | Icons on |
|---|---|---|
| Desktop, light | [PNG](evidence/desktop-light-icons-off.png) · [HTML](evidence/desktop-light-icons-off.html) | [PNG](evidence/desktop-light-icons-on.png) · [HTML](evidence/desktop-light-icons-on.html) |
| Desktop, dark | [PNG](evidence/desktop-dark-icons-off.png) · [HTML](evidence/desktop-dark-icons-off.html) | [PNG](evidence/desktop-dark-icons-on.png) · [HTML](evidence/desktop-dark-icons-on.html) |
| Phone, light | [PNG](evidence/phone-light-icons-off.png) · [HTML](evidence/phone-light-icons-off.html) | [PNG](evidence/phone-light-icons-on.png) · [HTML](evidence/phone-light-icons-on.html) |
| Phone, dark | [PNG](evidence/phone-dark-icons-off.png) · [HTML](evidence/phone-dark-icons-off.html) | [PNG](evidence/phone-dark-icons-on.png) · [HTML](evidence/phone-dark-icons-on.html) |

### Development failures resolved

Initial web checks caught unformatted new code and a CSS specificity warning; corrected and rerun. The first daemon run lacked Python `referencing`; rerun with the requirements-ci venv passed. Browser fixture construction initially omitted required agent fields, used the index id rather than the appearance route slug, and then used non-lab workspace names during lab captures; corrected, and both cases passed. One invocation repeated `--spec` and ran only the last spec; each required spec was then run separately. Captures now wait for theme transitions to settle. These were test/tool setup errors, not accepted failing checks. Initial generated HTML triggered diff-check whitespace findings after staging; normalized and rechecked. Exploratory path lookups and one nonunique edit were retried with the actual path/exact context; no changes were lost.
