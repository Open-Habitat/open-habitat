# Implementation and blocked validation — 2026-10-20

Implementation is committed as `fde2427b` on the worker branch. **Not merged; issue remains open.** The worker's required daemon check fails, including on the unchanged base, so the run must report failure rather than waive that check.

## Delivered code

- The existing signed-in-account storage read drives a single-flight, ten-second browser observation. A warning starts at 90%; a full/ext4-block-exhausted quota shows usage/limit, a direct Settings → Storage/Trash action, cleanup guidance and an explicit recheck. A failed read retains the previous observation as explicitly stale. Identity changes discard it.
- Full-quota presentation replaces secondary stale-history/Pi-status notices, retaining available history. Rechecking or observing space recovered rereads conversation state/history; neither starts Pi nor resends a message. Both browser-controlled and read-only histories participate.
- Daemon writes to ownership/origin, workspace settings and attachments classify wrapped EDQUOT/ENOSPC. Pi stderr, failed RPC responses, assistant error frames and helper failures produce fixed `native_storage` diagnostics (`quota_full`/`storage_full`), not raw paths, credentials or provider text. Settings-manager errors and auth errors retain only their errno classification. Stderr draining is bounded at direct-child exit, including inherited descriptors.
- No agent-facing notice, contract change, new store, quota enforcement change, user/authority change, Fleetrepo edit, deployment or push.

## Review

Focused self-review: these are presentation, read-only quota observation and diagnostic classification changes, not a change to the Unix-user security boundary, gateway/daemon/broker authority or installation hardening. No independent security review is claimed. Reviewed identity-keyed disposal, stale quota handling, single-flight reads, recovery without write replay, native-text redaction and child/pipe lifetime. Tests cover a synthetic eight-byte write budget returning wrapped EDQUOT, recovery after that budget is replenished, split/bounded native diagnostics, and failure-frame discrimination. This is synthetic errno evidence, not real Linux quota enforcement or distinct-UID evidence.

## Checks and evidence

Base: `4be7a622b25dba3ca840606c70de8323234b24c8`. Remote captures recorded dirty source plus the explicitly selected new files; the implementation commit records those final runnable bytes. All commands used disk-backed `TMPDIR=/var/tmp`. Runner jobs prepare the pinned Pi fixture with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` and use umask 077. Shared-runner queue time dominated the observed command durations.

Final web sources passed `./scripts/test-focused.sh --area web`: job `7060747c5740cf63b42fa1b05887491e096b692ecb28adc19425b83ff1108ca6`, snapshot `08fe2634c48c23e54c97a95a821e5b64e291328642a46275ea90b9ae31bf63cb`, evidence `/var/tmp/oh-browser-mc7jpthp`. Format, lint, typecheck, **269 unit + 192 component tests passed**, including quota failure/identity and single-flight tests. An earlier feedback web run also passed (`c394147698dd179a0003b40d7985f4877ee8ca4ca50105a869adf8176bf63486`), but is not the final evidence. The only subsequent Go source correction removed an unused import; the tested web sources did not change.

`./scripts/test-focused.sh --area contracts` passed: job `71e65ce5bc082fe80bd98250708779625df5ee18eaa500fc0b7e258eb362dd1f`, evidence `/var/tmp/oh-browser-ci9r3k2f`. No contract inputs changed.

`./scripts/test-focused.sh --area browser --spec quota-pressure.spec.ts` passed: **1 passed (7.9s)** including Axe, retained history under quota-full failure, Settings/Trash navigation, recovery without reload and no writes on recheck. Job `ca6da61fcf64a4b1a278de94db9580ebac66595e7e60a7bf39cc5f3d5a57a794`, evidence `/var/tmp/oh-browser-idassd_n`. This is host-backed synthetic browser evidence with a mocked quota read, not a live quota test.

`./scripts/test-focused.sh --area go --go-package ./internal/daemon` built and completed go vet, but the package **failed** in five terminal/tmux cases on two corrected-source attempts:

- `TestTerminalShellRunsAsPersonInWorkspaceAndSurvivesBrowser`: no shell after browser disconnect.
- `TestTerminalBusyShellAndClose`: empty shell list, no busy observation.
- `TestTerminalTaskfleetAttachIsReadOnly`: empty Taskfleet window list.
- `TestTerminalLingeringStartsServerAsUserService`: terminal creation fails, WebSocket close 4503.
- `TestTerminalNewShellFindsInstalledToolWithOldServerPath`: terminal creation fails, close 4503.

First corrected attempt: job `4dd016dc5c3abb275656126627f768bc164487990678d9a3ff6d115cf3b851f6`, evidence `/var/tmp/oh-browser-qxrhrkhe`. Retry: job `feec7ffc23fd8c73b6a4c34354b8a0d5b374ba841f67b56fb8ec8af4f8d5d8d7`, evidence `/var/tmp/oh-browser-e1mu2qbu`. No quota test failures or race reports appeared, but this is **not a passing package result**.

The same required command was run from a disposable clone of the **unchanged base revision**, with no implementation files: job `f59cb7a3ab335258456610bb3730feb291407edf6aa2d34c68895e16764c6384`, evidence `/var/tmp/oh-browser-k6ic28zc`. It reproduced exactly those five failures. This proves they predate this implementation in this runner, not whether the cause is product code or runner installation. No Fleetrepo modification is prescribed without that diagnosis.

The wider affected conversation regression run, `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`, completed **65 passed, 2 failed**: phone model-pill height was 59.5625px (expected ≤36), and desktop three-Tab focus did not reach the model pill. Job `10806c9f4b02587607c13bd56acb485fa966080650bd75c849e214c30931630f`, evidence `/var/tmp/oh-browser-63oa30ss`. These concern model-picker layout/tab order, not the passing quota journey; their unchanged-base behavior was not independently tested. They remain failed checks, not waived passes.

All new files were explicitly selected with `--untracked` in relevant captures. Targeted Biome and `git diff --check` passed. No full clean gate, lab/capture run, before/after screenshots or static HTML capture was attempted: Alder's current policy defers lab/capture runs. Live recheck by Jari remains pending conductor deployment.

## Failure / incomplete-step inventory

- Exploratory file/glob probes hit absent guessed AppShell/Layout/NativeHistory, daemon HTTP/process/service/server, gateway storage and browser-spec paths, plus a result file present only on newer main. Actual callers were located and read instead. These were discovery misses, not omitted implementation steps.
- The first targeted Biome run rejected the recheck-counter dependency. The effect now explicitly consumes the counter, and subsequent Biome plus focused web checks passed.
- Two early daemon submissions (`f34e7a6589320a6a1598a4caba672407af703de38035bcb1c22a6a996e90164e`, `efe6c5e330fc3d11100c25550ad2be338393d2684f436f9e3e94bf76c46fd844`) and two early browser submissions (`137153077f09c8554858d29bd95188a657525cf57aae7809c000cc4ecee5a5ec`, `787791e6830c4edeaec8082eebb6b1cfd8cf5e00ae80c9d05de358d8dc957dd6`) captured the now-removed unused `io` import in `pi_device_linux.go`. Corrected-source checks built successfully; the remaining actual failures are listed above.
- A script parsing a bounded displayed runner-log line failed on truncated/control-character JSON. Reading the retained complete `*-logs.json` response succeeded; no test result was inferred from the failed parse.
- Two corrected daemon attempts, the unchanged-base comparison and the wider browser suite failed as detailed above. Required validation is therefore **blocked**. No merge or issue close is claimed.
- Captures and live recheck are deferred as stated above, not passing evidence. All launched jobs have reached terminal outcomes.

## Next action

Diagnose and repair the terminal/tmux baseline failures, resolve the two model-control regression checks, then rerun the affected checks before landing. Preserve the quota implementation and its passing evidence. The conductor owns any eventual deployment and Jari's live quota recheck; no specific Fleetrepo installation change has been established.
