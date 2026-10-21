# Result

Fixed on base `b539e374` (the commit with `Fixes-Issue: lab-suite-red` carries the tested changes).

- Snapshots use caller-supplied `OH_LAB_REVISION`, otherwise `unknown`; no Git process or checkout is required. Revision text cannot close the metadata comment.
- Composer tests wait for native controls rather than racing the temporary creation draft. The added attachment button is now verified in keyboard order and phone label collapse; existing interaction/geometry assertions remain.
- The 64px reopening gap was competing scroll owners: EditorSplit restored a stale anchor after the conversation followed footer height changes. Split anchoring now restores only on content-width reflow, including padding changes at fixed outer width. A component regression covers width versus height deliveries.

- A further cursor-expiry lab race captured the temporary workspace URL before creation returned an ID (3/5 failed on repetition). It now waits for the durable conversation route before leaving; all five repeats pass.

Focused product review: claude-fable-5-1 identified the content-box measurement edge case, fixed above; self-review checked all test preconditions and retained assertions. Local report: `history/review-lab-suite-red.md`.

## Verification

Host-backed synthetic evidence on Fleetrepo's warm Cedar path:

- `cd web && npx playwright test --config playwright.lab.config.ts`: **62 passed**, 32.9s test time / **34.90s wall**, `/var/tmp/lab-full-complete.log`.
- Three affected specs, `--repeat-each 3`: **30 passed** (15.6s), `/var/tmp/lab-fixed-focused.log` (before the final explicit native-control readiness precondition).
- `tests/workspace-editor.spec.ts`: **5 passed**, `/var/tmp/lab-editor-complete.log`.
- `./scripts/test-web-fast.sh`: format, lint, types and **479 tests / 82 files passed**, `/var/tmp/lab-web-fast-closure.log`.
- `issuectl doctor --json`, project-view validator and `git diff --check`: passed.

No full clean gate, native local browser run, live provider or distinct-UID isolation claim.

## Diagnostic failures

Initial reproductions failed as expected and isolated the scroll owner; temporary instrumentation was removed. The first fast check lacked local dependencies; `npm ci --prefix web` followed by the complete retry passed. Direct SCP/SSH trace retrieval from the VM was unavailable (connection closed/empty response); instrumented browser logs supplied the scrollTop setter stacks instead. Some exploratory path lookups missed renamed files; repository searches located the current files. The added component test initially failed lint and TypeScript checks; both were corrected and the complete fast check rerun. Optional model-performance logging failed because SSH-to-self on Alder refused the key (`/var/tmp/lab-model-assessment.log`); the review itself completed successfully (`/var/tmp/lab-review.log`). No required validation remains blocked.
