# Result

## Change

Workspace deletion still blocks on the same process scan. A presentation-only
native lookup now identifies this workspace's product tmux panes and their
same-UID descendants, and the person's code-server socket argument in an
ancestor. It does not identify products from `bash` or `MainThread` alone.
Product blockers are deduplicated per editor / terminal shell; unknown processes
keep the existing PID wording and every failed lookup leaves blocking intact.

The dialog offers **Sulje pääte** and **Pysäytä editori (kaikki ikkunat)**,
warns to save files and explains the editor-wide effect. Closing uses the
existing terminal endpoint. Editor stop accepts no PID or path: the authenticated
app session reaches only its person's daemon, which stops the fixed user
service or its owned child group. Successful stop waits for socket absence;
lifecycle contention is refused before any signal. Each successful action
rechecks deletion; it never deletes implicitly. A shell already ended elsewhere
also rechecks. Other refused/uncertain writes remain visible and are not retried.

## Independent review

Critical review was proportionate because the new editor stop route signals
native processes. `claude-fable-5-1` reviewed the diff, `gpt-6-astra` independently
checked authorization/process lifetime, and one narrow continuation checked the
repairs. Assessment: four confirmed FIX rows, all addressed:

- Do not report `stopped` merely because SIGTERM was accepted.
- Recheck a typed `shell_ended` refusal.
- Keep ownership when an interrupted startup has not bound its socket yet;
  never overwrite that live child on retry.
- Do not wait behind startup's lifecycle mutex and act after the stop response
  deadline: refuse contention immediately with `editor_busy` (409).

The final ownership and PID-reuse fences were independently checked. The final
localized contention repair was self-reviewed against the verifier's finding.
No unresolved authorization finding or follow-up issue remains.

The finder's attempted `go vet` was blocked by the host execution hook and its
extra test commands did not produce a verdict during the review. They are not
claimed as validation. Maintained runner validation below is authoritative.

## Validation

All runs used disposable synthetic homes and the maintained shared ARM runner,
with disk-backed `/var/tmp` scratch. No test server was touched and no push or
installation change was made.

Final runnable inputs were captured from dirty base
`5f809e18be072746849e2a2fc446c1e373e9f714` in gate job
`143aed5a8d1f57b21e8886fec8ce2e3ea05969e70a40d37c13cd2d8a05b96987`,
source snapshot
`f730ce1b18e933500f194f47c368aa6f4bd8b6f78bd3386fe6b55bef86a88134`.

That `TMPDIR=/var/tmp ./scripts/ci-local.sh --json` run passed:

- Web formatting, lint, types and all 475 unit/component tests.
- All Go packages, including daemon (51.624 s), integrations and gateway.
- Generated-contract and contract validation checks (Go/contracts exit 0).
- The complete `browser-shell.spec.ts`, including the new product-blocker
  close/recheck journey and its dialog accessibility check.
- Production web and Storybook builds.

The broad gate is **not green**: ordinary Playwright had 286 passes, 3 skips
and six failures outside this change. They are account model-choice reload,
uncertain send, interrupted clone recovery, provider-layout contrast, queued
stop state and thread geometry. The lab phase/production release gate are not
claimed. No clean-gate receipt was produced.

An unchanged main clone at
`159a227dfea34033252c6d33ca50ce273048e9a0` ran the same gate command (job
`42fb5a6a24bc7b03b7ac9c1c461f8f1339c7ee309c2b3b8afcb32597e81dca65`).
That commit differs from the worker base only in documentation. Main also failed
uncertain send, clone recovery, provider-layout contrast, queued stop state and
thread geometry. The uncertain-send, contrast, queued-stop and geometry
assertions fail the same way; clone recovery fails at another step in the same
case, so it is not described as an identical assertion. Main additionally had
landing timing, single-workspace contrast and an integration skill-file timing
failure. These are test-health observations, not fixes attributed to this task.

The account-settings failure was also reproduced on unchanged main with
`./scripts/test-focused.sh --area browser --spec account-settings.spec.ts`
(job `3cdbf516af898dc26fbe0f5a97b2322466a5849317adbe126fcfd63317cac5cd`):
11 cases passed, and the same model-choice reload case failed at line 345
because the `Viesti Pi:lle` textbox was absent. Thus this final-gate failure is
also independently demonstrated as pre-existing.

All requested focused checks passed:

| Command (`./scripts/test-focused.sh`) | Job | Result |
| --- | --- | --- |
| `--area web` | `889ad0ca5920c8e251fd50224df0b151250c35c7cf7f31627b4626b49479dbdb` | passed |
| `--area go --go-package ./internal/daemon` | `416ee1e49afff4d537d2a912683911b46226a7bad06891efc3f5d64979d77f12` | passed; final lifecycle code additionally covered by final gate Go pass |
| `--area go --go-package ./internal/gateway` | `9fd9ee4cac8bf1134230f9a9ff8b9de8cb295362078a1fc8cdb418c7363ce6d9` | passed |
| `--area contracts` | `c3d870b14ed1797be5f21b0f032e0d15167995f1e6c60581e0c33f7d3e78c8db` | passed |
| `--area browser --spec browser-shell.spec.ts` | `dc552c32fcd4cbeaac4a3dc25dc3ecdd850850b6a120f16f0f9fe82e58a517ac` | 9 passed, including product controls and axe |

A subsequent worker `account-settings.spec.ts` recheck also passed all 12 cases
(job `e734355cb8c242275ff2defb98be5e57cad840e0e0ce712a3afca0cbc6185f28`),
without changing runnable bytes. The unchanged-main clone-page focused recheck
passed 7 cases with 1 skip (job
`e5131546553bb1d927f64d5e5181e66c0ac23cc388c73f0687b04a220b50b63d`).
These supplementary passes do not turn the broad gate green.

The supplementary worker clone-page focused recheck (job
`072713479f15c40ed3589111b209f87971d1226c08c607a169e08f072488ca3b`)
passed 6 cases, skipped 1 and failed interrupted-clone recovery while clicking
`Poista keskeneräinen` (line 212). The earlier final gate failed this case at
`Aloita alusta` (line 219); unchanged main's full gate failed it at the missing
second card (line 209), and its focused rerun passed. This is an unstable
existing case, **not proof of an identical failing assertion on main**. That
supplementary workflow remains non-green and is disclosed rather than waived as
an exact match. It does not block this delivery: every required focused check
passes, the changed paths have final Go/contracts/browser evidence, and no clone
creation/recovery handler or clone UI code changed. The broad test-health gate
still needs separate follow-up; this result does not authorize a gated release.

## Coverage limits and failure inventory

The browser journey supplies synthetic product hints and editor-stop replies,
but closes a real native tmux shell and then exercises the real `shell_ended`
refusal before rechecking. Go tests cover the native pane query, same-UID
ancestry versus unrelated names/socket paths, actual fake-code-server group
shutdown, interrupted startup ownership and immediate busy refusal. This is
not live code-server or distinct-kernel-UID isolation evidence.

Before/after lab image + HTML captures were deferred under the host's no-local
lab/capture policy. The maintained focused browser/axe checks provide interaction
evidence instead. No Fleetrepo installation change is required.

Initial broad validation found two mistakes in new tests: expecting 404 instead
of the existing editor-origin 403, and supplying `state: blocked` instead of
`state: checked` in a delete-check fixture. Both were corrected; neither is
waived as pre-existing. One queued intermediate gate was deliberately cancelled
before execution after the last review repair, then replaced by the final
captured run above. Early filename-discovery probes missed inferred paths;
correctly scoped file discovery recovered them. No required validation is
silently counted as passing.
