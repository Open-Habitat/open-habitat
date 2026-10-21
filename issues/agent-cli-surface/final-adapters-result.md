# Final slice 3 adapters

The remaining daemon-owned inventory is now implemented: `question answer/cancel`,
`integration-login create/show/update/delete`, `pi-login create/show/delete` and
`claude-login create/show/update/delete`. The reconciled inventory is in
`issues/agent-cli/research.md`. Native git/gh/tmux/Taskfleet/file tools keep the
rows they own; no new history/credential/workspace store is introduced.

## Authority and native truth

Agent routes are exact entries on the daemon's own-UID-only listener, never a
forward to the browser mux. Browser-session headers are ignored by these agent
adapters. A fixed adapter-selected owner outside the browser-token namespace
keeps agent attempts separate; request fields never select user identity.
Integration agents share the catalog relay's native process, folder membership,
quota and cancellation checks. Browser attempts cannot be read/answered/cancelled
as agent attempts, or vice versa. Pi attempts keep the device's single-active
native fence and require the exact returned 32-hex ID on show/delete. Completion
reobserves native credentials and clears controller auth failures as browser
completion does. Daemon restart loses attempt observations, not native credentials.

Claude browser and agent routes share one native controller and process-reaping
fence, so a cancelled/expiring child must finish before a successor starts.
One-time codes use the existing spent-submission fence and exact attempt ID.
Claude's own tool alone writes its native credential store. The host keeps no
credential copy. Existing native Claude completion/model-default tests still run.

Question dispatch calls the existing native controller: exact native request ID,
spent-ID-before-write, offered choice/type checks and uncertainty are unchanged.
A successful HTTP reply is still uncertain delivery, never approval or completion.
The native question regression now exercises agent dispatch; the existing
browser/distinct-UID question checks retain that adapter's coverage.

Input JSON uses bounded private-file/redirected-stdin reads, rejects duplicate
keys and cannot choose an action. New secret-surface argv/global errors never
include supplied values. Codes and loopback redirects are never reflected in
responses or diagnostics. Login URLs/device codes intentionally reach the agent
so it can hand them to the person; provider passwords are never part of these
adapters. Every mutation rejects truthful-preview-impossible dry-run before
consuming input, and warns against automatic replay of unknown outcomes.

## Review, checks and limits

Final measured outcomes are added here before landing. All native/provider
fixtures are synthetic; there is no claim of real provider consent or live-server
isolation. No Fleetrepo change is required. The conductor owns live acceptance
after merged main deploys. The whole-surface canon v4 review is complete, with
inherited partial mandates preserved in `CONFORMANCE.md`, not a fabricated full
pass. No full gate is run by this worker.

## Failure inventory

The first focused new-adapter test run found a synthetic integration redirect
fixture missing its required `state=s1`; the native script correctly refused it.
The fixture now supplies the expected state. This was not a provider/native
failure and is rerun with the required final suites. The early affected race
suites passed in 106 s before the final tests/process-reaping fence were added;
that is development feedback, not the final evidence.

The first sandbox canon probe could not execute the binary: Podman's tmpfs
parser rejected `uid=21001` (exit 125). The wrapper now creates its synthetic
home as the fictional UID inside an isolated mode-1777 tmpfs; a manual version
probe then succeeded and the complete advisory review was rerun. Its eight
remaining runtime reports are the known envelope-reading/unsupported-doctor
probe limitations, not failed binary execution. A jq query initially assumed
`data` in the project-canon report; the report actually has top-level fields,
which were then queried directly. Exploratory absent-file/glob reads and the
original brief's old ADR filename were resolved against the actual tree.

### Validation before review fixes

- `umask 077; TMPDIR=/var/tmp go test -race ./internal/cli ./internal/daemon
  ./internal/daemon/integrations ./internal/transport ./internal/contracts`:
  pass (CLI 8.303 s, daemon 82.847 s, integrations 11.299 s; transport cached,
  contracts has no Go tests).
- `./scripts/test-agent-uids.sh`: pass, including all new route families behind
  real owner/root/other/gateway UID admission/denial, permissive-mode peer
  rejection, both activation paths and simultaneous activation, broker socket
  restoration. Its main distinct-UID scenario took 142.74 s.
- `./scripts/test-focused.sh --area contracts`: pass, 63 schemas, 65 fixture
  files, 39 scenarios and 17 negative checks. Pi's additive optional agent
  attempt ID is canonical and generated for Go/TypeScript; browser attempts
  retain their existing shape.
- `./scripts/test-web-fast.sh`: pass after clean web dependency install. Only
  generated bindings change on the browser side; no production UI interaction
  changed and no Playwright/live-provider claim is made.
- These four checks plus dependency setup completed in 271 s combined.
- The focused native/CLI/help and exact own-UID socket route tests plus issue
  doctor, project-view validation and whitespace checks passed in another 14 s.
- Built-binary `project-canon review --profile cli --run <sandbox-wrapper>
  --verbose --json .`: executed successfully after the wrapper repair. It
  reports ten advisory gaps: eight envelope/unsupported-doctor probe reports,
  the Rust-only layout check, and repository-front-door README advice. The
  separate source/test judgment retains eight actual inherited partial sections
  in `CONFORMANCE.md`. No staged issue commands were executed, and no new canon
  dimension is proposed.

These are intermediate evidence once review fixes land; affected race/contract
and UID checks are rerun on the final runnable tree before closure.

### Independent security review and assessment

`/llm-review` critical used `claude-fable-5-1` as finder (227 s) and
`gpt-6-astra` as an independent refutation verifier (87 s). The host traced each
candidate against source before verification. Three confirmed should-fix items
were classified by `/assess-findings` as CONFIRMED/OCCASIONAL/IMPROVES → FIX:

1. Pi terminal credential refresh and integration replacement cleanup can exceed
   the default eight-second CLI budget. Exact **base** paths now select 25 s for
   Pi (including query-bearing show/delete) and 55 s for integration login.
   The verifier refuted the broader claim that current native redirects block
   for 30 s, and that standalone Claude's five-second helper needs a longer
   deadline; Claude retains eight seconds.
2. The three new login paths now preserve the daemon's fixed actionable 4xx
   codes and exit 1 instead of collapsing refusal into system uncertainty.
   Native 503 still reports unknown outcome/system exit 2, never safe replay.
3. Separate browser/agent Pi leases share one PiDevice; its active conflict now
   uses a sentinel mapped to 409 `attempt_active`, not an outage/503 diagnostic.
   The regression models two leases/one native device in both directions and
   proves the losing adapter cannot read/cancel even a known foreign ID.

The CLI budget/refusal mapping is factored into private helpers for regression
coverage at that exact boundary. Native ownership, device exclusion and socket
checks are unchanged. Host follow-through also retains redacted failed native
login guidance in `error.result`, so an administrator-consent URL does not
vanish on the failure path; native tokens/codes are still never reflected.

The independent review found no own-UID bypass, session-lease borrowing, raw
credential leak or gateway/broker operation. There is no unresolved security
candidate and no follow-up issue filed. Local `history/review-agent-final-adapters.md`
and `history/assessment-agent-final-adapters.{json,md}` carry the working review;
this tracked result carries its durable conclusion without depending on them.
Required final post-fix validation is recorded separately below.

Optional model-performance publication was attempted once through the prescribed
`assess-models.sh` helper. It exited 3 because SSH-to-self (`alder`) was denied
(`Permission denied (publickey,password)`, ssh exit 255). No corpus worktree or
credentials were changed and no alternate transport was improvised. Both
required model calls and assessment completed; only optional corpus publication
is missing. The scoring input and error log remain under
`/var/tmp/agent-final-evidence/` on this worker host.

### Final post-review validation

All affected checks were rerun after the review fixes, including the two-lease
Pi conflict regression, native refusal/deadline regression and redacted consent
failure regression:

- `umask 077; TMPDIR=/var/tmp go test -race ./internal/cli ./internal/daemon
  ./internal/daemon/integrations ./internal/transport ./internal/contracts`:
  pass (CLI 8.260 s, daemon 85.167 s, integrations 11.372 s; transport cached,
  contracts has no Go tests).
- `./scripts/test-agent-uids.sh`: pass, including all new routes and the existing
  activation, default-deny, root/other/gateway denial and broker restore cases.
- `./scripts/test-focused.sh --area contracts`: pass (63 schemas, 65 fixtures,
  39 scenarios, 17 negative checks).
- `./scripts/test-web-fast.sh`: pass. No production UI changes or browser/live
  provider acceptance are claimed.
- The final four-command validation completed in **271 s**. A fresh binary and
  sandboxed canon probe also completed successfully after the localized fixes.

Tested working diff is based on `f4b699cf5fedb6d7be678f4fb783902c897d30c5`;
SHA-256 of the final runnable/contract/test diff (CLI, daemon, generated contracts,
canonical contracts, contract validator and web bindings) is
`3925917424d81610b82877eaa93387fd4dd9984a3126e01e7f46312d1ae9372a`.
Only documentation/issue closure changes follow these tests. Required checks and
reviews are complete; the sole unresolved optional sub-workflow failure is
model-performance publication, disclosed above. No Fleetrepo work is proposed.
