# Helper archive flow

Implemented the accepted Vahvistus + Arkistossa directions behind **Avustajat**.
Archive reads the helpers before writing, shows their states and branch work,
and lets the person cancel. A confirmed empty list keeps one-press archiving.
The workspace archive reads helper rows only while open. After a confirmed
restore, the conversation's end shows the helpers' current rounds, latest
report and unfinished branch work. **Avaa haara** opens branch/source/worktree
facts, not a merge or start command. Finnish and English catalogs are included.

No daemon, contract or authority change. Inspection found an important detail
missing from the prototype's account: live list rows have empty branch/worktree
fields. The existing selected-run spinoff route supplies them; the branch
window reads that route only when opened. The test fixture reproduces this
list/detail difference instead of supplying branch fields the live list lacks.

## Decisions for later review

- **Restore note is this tab's view state**, scoped to the current session,
  kept while navigating conversations and removed by a later confirmed archive.
  Reloading the page clears it. It does not write Pi history or create an
  archive inventory. Alternative: a durable restore event, requiring a host
  change and a second record; the prototype explicitly called for no new store.
- **Say what is known now, not when it changed.** The restore note shows the
  latest native report and current round/landing state. It does not assert that
  every unread report arrived during the archive interval: the existing data
  does not prove that chronology. Alternative: persist an archive-time baseline.
- **Unavailable inventory asks conservatively**, including a missing/unsupported
  Taskfleet installation. Partial reads retain the helpers they did find with a
  warning. Neither is evidence that no helpers exist.
- **Archive expansion stays open across navigation**, keeping the actual details
  visibility and lazy reads synchronized. Helper state is read on opening, not
  continuously polled while reading the archive.
- **Branch facts use the existing selected-run read on demand.** No diff/change
  count and no new host read contract. A missing branch is shown as unavailable.
- **Restoring starts and merges nothing.** The displayed state remains
  Taskfleet's actual state; Habitat does not relabel an independently running
  helper as stopped or archived.

## Validation

Source base `507e5e3d9`, then rebased onto main `f98106995`; only
`KOKEILTAVAA.md` conflicted, and both workers' lines were retained. Final focused
checks passed on implementation revision `278a7b067` (subsequent amendment only
refreshes evidence and this result), not a clean gate.
All runs use synthetic identities, histories and helpers; no real resident
run/provider, separate-UID or installed-server claim.

- `./scripts/test-focused.sh --area web`: 191 files / 1434 tests pass,
  including new partial-inventory, selected-branch-read, duplicate-read and
  session-change cancellation tests. Catalog checks, Biome and TypeScript pass.
- `./scripts/test-focused.sh --area browser --spec helper-archive.spec.ts`:
  passes in the ordinary synthetic host and in lab capture mode. Verifies no
  archive before confirmation, Escape/focus, unavailable-read cancellation,
  archive rows, restore note, lazy branch facts and rearchive clearing the note;
  dialog axe audit passes.
- `--spec rail-archive.spec.ts`: 2 pass, desktop keyboard and touch. Corrected
  its stale keyboard-order assertion: the previously added Not now action
  precedes Rename; no production keyboard behavior changed.
- `--spec named-workers.spec.ts`: passes (chip, helper views, feature gate,
  report mark and accessibility).
- Browser runs use `umask 077`, private `/var/tmp` scratch,
  `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=15340`.
- Screenshot + static HTML pairs: `evidence/confirmation.{png,html}`,
  `evidence/archive.{png,html}`, `evidence/restored.{png,html}`. Synthetic lab,
  1280×900, DPR 2, light theme. Inspected confirmation and restore captures.
  No new dark/phone visual capture; shared tokens and existing touch archive
  test cover only part of that surface.

## Independent review and assessment

`/llm-review`: claude-fable-5-1 finder, gpt-6-astra verifier; two calls. Local
verification and `/assess-findings`: five FIX, one DROP, no residual issue.
Fixed partial inventory being hidden, stale restore markers, misleading unknown
state icon, uncontrolled archive expansion, and slow preflight feedback and
concurrency. The lock permits the inverse Undo to queue during a pending write.
Cancellation cannot continue after a session change. A cancelled card question
is not shown as a failed write. Also clear the old archive notice after restore
from any entry point, avoiding contradictory archive/restore messages.
Scratch reports are `history/review-helper-archive-flow.md` and
`history/assessment-helper-archive-flow.{json,md}`; model assessment was logged
successfully to Alder's corpus.

## Validation corrections

Early checks found local lint/type errors, an invalid capitalized synthetic
resident name, capture invoked without the lab marker/origin, and a focus check
racing the conversation row's move into Your turn. These were corrected and the
final checks rerun. Repeated `--spec` selects only the last spec, so regression
specs were then run separately. The old rail keyboard assertion was corrected
as described above. Captured HTML's generated trailing whitespace was normalized
after capture so `git diff --check` is clean. Issue doctor and project-view
validation pass (doctor has the repository's existing image-format advisories).
No failed check is represented as passing evidence.
