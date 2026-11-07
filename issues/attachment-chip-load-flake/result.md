# Result

Fixed the product, not a timeout. No PDF or upload protocol change.

## Cause

`App.tsx` assigns a key to the view in which a conversation is created and
adopts it into `createdViews` once the conversation has an ID. Rendering its
ID route retires the workspace's creation key so the next conversation gets a
fresh view. A concurrent creation-route render can resume after that retirement;
it previously minted a new key and overwrote the already-adopted ID's key.
The same conversation consequently mounted again, cancelling the composer's
upload (or closing a preview that had just opened).

The reproduced trace includes `POST /api/v1/attachments` returning 200 in
76 ms, yet zero chips after 30 seconds. Temporary probes then showed three
different view keys for the same conversation, with `CHIP cleanup true` between
upload start and completion. This is not the earlier detached-drop target bug
(fixed in commit effc81f91, historical issue gate-r56c-load-reds).

The adopted conversation key now wins on every creation-route render. New
creations without an ID still use a fresh workspace creation key. The existing
identity and upload-cancellation boundaries are unchanged. Probes were removed.

## Regression and evidence

The document spec now holds creation and upload independently, drops the files
while creation is pending, opens the created conversation while upload is held,
and asserts that the original field remains connected. Then it releases the
upload and runs the existing chip, preview, hostile-document and axe assertions.
It covers the required lifetime without waiting until the dangerous transition
is over. React's replay scheduling is still nondeterministic; this is also a
repeated load probe, not a claim of a deterministic reproduction every run.

On Birch, base b5befbe4e plus this issue's diff, two workers, port base 16300,
umask 077, scratch `/var/tmp/oh-chip.xCohY8`:

| Probe | Before | After |
|---|---|---|
| Original embedded-font case, CPU throttle 4, reply jitter 250ms | 1/12 chip failures | — |
| Original case with lifecycle probes, CPU4 | 6/16 failures (4 missing chip, 2 preview lost after chip) | — |
| Original case with probes, CPU2 | 3/12 and 2/8 failures | — |
| Original case, no probes, CPU2 | — | 20/20 pass |
| Strengthened case, CPU2, seed chip-before | 1/12 field-disconnection failures | — |
| Entire strengthened spec, CPU2, 250ms jitter | — | 24/24 pass, then final 24/24 pass (seed chip-final) |

Commands: `npx playwright test tests/attachment-documents.spec.ts --grep
'embedded font' --repeat-each N` for the isolated probes, and the same spec
without grep with `--repeat-each 12` for the final 24 cases. Environment:
`OH_CPU_THROTTLE=2` (4 where noted), `OH_REPLY_DELAY_MS=250`,
`OH_REPLY_SEED=chip-before` or `chip-final`. No CPU hogs or whole suite run.
An initial unthrottled strengthened-test probe passed 4/4 on old code, further
confirming that the scheduling trigger is not deterministic.

Required focused checks passed:
- `./scripts/test-focused.sh --area web`: static checks and 1351 tests / 179 files;
  after rebase, 1372 tests / 180 files.
- `./scripts/test-focused.sh --area browser --spec attachment-documents.spec.ts`: 2/2.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`.

These are host-backed synthetic browser results, not live-provider or distinct
UID evidence. Full integrated-suite confirmation belongs to the conductor and
was deliberately not run here. The combined acceptance checkbox remains
unchecked for that full-suite clause; issue status is fixed as required by the
worker brief, with this final integration check handed to the conductor.

## Integration recheck

Rebase onto the round's landings conflicted only in KOKEILTAVAA.md; both sides'
lines were retained. The graduated workspace start page now has its own composer.
Our new helper initially mistook that old page's enabled attach button for the
pending conversation: 2/2 integration cases failed the field-connectivity check,
and diagnostic CPU4 probes reproduced 1/12 and 3/16. View-key probes showed the
conversation key stayed stable; the captured field belonged to the preceding
workspace page. The helper now waits for the creation frame before dropping,
while still holding creation and upload independently. Final rebased whole-spec
CPU4 + 250ms jitter run: **24/24 passed**, seed `chip-rebased`. All diagnostic
logging was removed. This was a test navigation precondition, not another
upload defect; the original adoption-key fix is unchanged.

## Review

Focused self-review plus independent claude-fable-5-1 finder and gpt-6-astra
concurrency verifier: no product findings. Both checked subsequent creation,
late renders, and the test barriers. Assessment retained the scheduling-dependent
coverage limitation; no separate production registry abstraction was introduced
solely to unit-test replay. Review and assessment artifacts are under ignored
`history/`; model-performance logging was omitted because its writer pushes.

## Decisions for later review

None: preserving the existing conversation's composer and upload implements
already-agreed behavior. No product or authority choice changed.

## Tool/sub-workflow failures

Expected pre-fix load failures above established the cause. Initial web checks
rejected assignment nested in a nullish expression; rewritten as a guarded
assignment, final checks pass. First consultation used unsupported `--prompt`;
help was read and the call rerun successfully through stdin. Exploratory shell
lookups found no optional cache/glob paths, and one trace parser hit an empty
trace segment; corrected scoped lookups/parsing succeeded. One documentation
edit found two matching headings and was retried with unique context. None left partial
product state or a running background job.
