# Result — 2026-11-02

Spec/config changes only. No product or host code changed. The maintained ordering harness was already on this branch; the obsolete throwaway instrumentation was not applied or committed.

## Changes

- Both Playwright configs reduce motion. Activity-line explicitly tests normal motion; process-tray opts in only around its pulse assertions, then restores reduced motion.
- Archive tests wait for the native route/confirmed archive, and hold Pi until the test has left the conversation or pressed Stop. Quiet-rail waits for the native answer before leaving, not the initially quiet empty row.
- Recap delivery is held until composition begins; its timer advances with `page.clock`. The SSE stand-in now fires `open`, satisfying the journal watchdog.
- Paging waits for rendered progress, not a response that recovery can supersede. All eight user messages must subsequently occur exactly once. Crash/reload waits for stopped native Pi with persisted history rather than an optimistic bubble.
- Account-role routes use one captured synthetic server response, eliminating fetch/fulfil across document cancellation. Rail return uses its actual link instead of interrupting requests with another document load.

Already-fixed cases were verified rather than rewritten: editor typing-pause clock control, immediate creation-response body reads, and several native/readiness fixes inherited from earlier workers. Unreproduced Chromium retries in site-onboarding did not justify a blanket retry helper.

## Evidence

Birch, base `9aea36fd`, with the spec changes in this issue's fixing commit. Dependencies installed from both lockfiles; private disk-backed TMPDIR and umask 077. All runs use two workers and `OH_PORT_BASE=11150`.

Before: `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=race-spec-signals OH_TIMEOUT_SCALE=4`, named ordinary/lab cases with `--repeat-each 2`: **21 failures / 78 executions**. After: same settings **plus `OH_CPU_THROTTLE=4`**, both named subsets repeated twice: **0 failures / 80 executions**, no skips or retries. The extra two executions are stream-revocation, omitted accidentally from the local before selection; its sweep baseline was 2/2 failures. CPU runs were not accompanied by artificial whole-host saturation.

Every listed case is included below. Locations in the first column refer to the original sweep, not current line numbers. Counts are failures/executions; variants are summed.

| Sweep case | Local before | Final CPU4 + D250 |
| --- | --- | --- |
| browser-editor-concurrent :66, both widths | 0/4 | 0/4 |
| lab-conversation :307, long-message recap | 1/2 | 0/2 |
| lab-conversation :819, combined SSE | 0/2 | 0/2 |
| lab-conversation-scroll :261 | 0/2 | 0/2 |
| pi-onboarding-race :6 | 0/2 | 0/2 |
| rail-archive :6 | 0/2 | 0/2 |
| browser-conversation :1878, idle archive | 2/2 | 0/2 |
| browser-conversation :2046, restored Stop | 2/2 | 0/2 |
| browser-conversation :2242, unsupported model | 0/2 | 0/2 |
| browser-conversation :3573, rail home/hover | 0/2 | 0/2 |
| lab-conversation :1127, paging/recovery | 0/2 | 0/2 |
| lab-conversation :1268, crash/reload | 2/2 | 0/2 |
| rail-icons-quiet :431 | 2/2 | 0/2 |
| shell-accessibility :64 | 0/2 | 0/2 |
| workspace-count-rail :45 | 2/2 | 0/2 |
| workspace-count-rail :128 | 2/2 | 0/2 |
| integrations :823 | 1/2 | 0/2 |
| start-here :23, four variants | 2/8 | 0/8 |
| browser-editor :220 | 0/2 | 0/2 |
| lab-integration-inventory :11, four variants | 0/8 | 0/8 |
| browser-conversation :3622, stream revocation | not run (sweep 2/2) | 0/2 |
| lab-conversation :388, failed recap | 0/2 | 0/2 |
| lab-outage-account :9, four variants | 4/8 | 0/8 |
| lab-slow-creation :4, three surfaces | 0/6 | 0/6 |
| site-onboarding :50 | 0/2 | 0/2 |
| rail-running-after-done :17 | 1/2 | 0/2 |
| pi-onboarding-restart :52 | 0/2 | 0/2 |
| Extra: latest-pill unread count | 0/2 | 0/2 |

Rebased onto main `54ac3cbd` (only KOKEILTAVAA additions conflicted; retained both). At rebased implementation `090ac75c`, fast web, issue doctor and project-view checks passed again, then **all 80 executions passed again** under the same CPU4/D250 settings: `/var/tmp/race-spec-rebase-ordinary.json` (46 passed, 304 s) and `/var/tmp/race-spec-rebase-lab.json` (34 passed, 196 s). Attachment worker's direct-picker changes were preserved untouched.

Pre-rebase final reports (disposable, on Birch): `/var/tmp/race-spec-final-ordinary.json` (46 passed, 254 s) and `/var/tmp/race-spec-final-lab.json` (34 passed, 170 s). Before reports: `/var/tmp/race-spec-before.json` and `/var/tmp/race-spec-lab-before.json`. Intermediate reports share that prefix and are not final passes.

Reproduction uses `npx playwright test <named specs> --grep '<case titles above>' --repeat-each 2 --reporter=json` from web, with `--config playwright.lab.config.ts` for lab. Named subsets do not take the whole-suite lock. No whole suite or clean gate was run.

Additional checks:

- `./scripts/test-focused.sh --area web`: passed after fixing this patch's formatting/non-null assertion (pre-existing informational Biome literal-key suggestions remain).
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag '@stream-revocation'`: passed with the same CPU/jitter settings.
- Motion regression subset: activity-line, process-tray's waiting-facts case, and loading-landing: **14/14 passed**, CPU4/D250, twice each.
- Focused self-review: checked all changed waits against product/fixture lifecycle, preserved native-content assertions, reviewed normal-motion opt-ins and route lifetimes. No independent review required for spec-only changes.
- `git diff --check`, issue doctor and project-view validator: passed.

These are same-UID synthetic browser/host results, not native-provider, live-host or UID-isolation evidence.

## Decisions for later review

- The long-message recap case now establishes an empty native recap baseline before enabling automatic recap on a second turn. This distinguishes a newly arriving recap from one already visible before typing (which intentionally stays). The first-read variant exposed a separate product defect: after its quiet timer, a first recap can appear despite an unsent draft. Filed unlaned as `recap-first-read-during-draft`, with reproduction and source evidence; no product fix was hidden in this spec pass.
- Paging no longer reads a body that the browser may discard during recovery. Rendered turn growth and eventual exhaustion are the progress signals; exact uniqueness of all eight native user messages replaces per-response first-user checks. This strengthens the content oracle rather than dropping it.
- Rail-running refresh uses keyboard activation because CPU stress reproduced the already-known group-5 tooltip interception. Pointer-overlay behavior is outside this group; no forced click or product workaround was added. Returning through the rail link still tests the same conversation state.
- The real-frame scroll geometry case retains its 700 ms oracle: replacing actual animation frames with simulated product time would stop measuring browser layout. It passed both CPU-throttled repeats without relaxing that bound. Pi-onboarding's session-order case also passed unchanged; no speculative timer edits were made.

## Intermediate failures

Expected red baseline: contrast, native identity/archive/reload boundaries, recap timing, Chromium retry and double-handled route. First CPU validation additionally found a paging response wait and the known tooltip interception. A temporary `clock.pauseAt(new Date())` after an installed clock failed with “Cannot fast-forward to the past”; removed, since the existing installed clock already supports the explicit advances. An attempted first empty-read wait under immediate automatic recap timed out; the final test establishes that baseline before enabling recap. Final repeated runs above pass. Exact-edit ambiguity/overlap refusals changed nothing and were retried with unique contexts. An initial web check found patch-local formatting and non-null assertion warnings; corrected and rerun successfully.
