# Private bounded Pi RPC transport intermediate (not a browser controller)

Adopted preserved commits `821ee35` and `aa6573f` from `wt/1esbvd70n4-bounded-native-pi-rpc` onto main at `3a3f883` as `7968956` and `2590b18`. The preserved branch remains untouched. The production code, tests and ADR diff are byte-identical to the previously independently reviewed final diff (gpt-6-astra finder, gemini-3.8-flash verification). That review corrected four concrete findings before adoption: recycled process-group signal, inherited stderr holding Wait, missing/null success misclassified as rejection, and detached-holder test race. The original review's ignored assessment was `history/assessment-bounded-pi-rpc.{json,md}` in its worktree; Claude finder returned no opinion. No changed risk surface was added in the adoption.

This is a private, unexported, currently uncalled daemon package transport, not a supported agent capability. A repository-wide Go call-site search finds `launchPiRPC` only in its own synthetic and pinned-Pi tests; no gateway, CLI, HTTP/SSE handler, contract, or web call site reaches it. It runs as the daemon UID (root denied), adds no privilege, sidecar or delegated cgroup, accepts only a fresh session, and refuses restart resume. Its single deadline covers write and acknowledgement, a non-reading child returns uncertainty, an ambiguous channel cannot be reused, the reader/reaper do not depend on inherited stdout EOF, and close is bounded and **always reports termination unknown**. A successful request is only a correlated Pi acknowledgement, not proof of settled history or stopped native tools. ADR 0003 documents this boundary. No test fixture code is in production paths or packaged web assets; the clean gate checks fixture exclusion in the release archive. No deployment or real credentials were used.

At adopted revision `2590b18`: `TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH go test -race ./internal/daemon -run TestPiRPC -count=1 -v` passed after `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund`. The tests cover fake acknowledgements, 25ms lost acknowledgements and nonreading stdin, no retry on ambiguity, inherited stdout from a detached child, malformed response, restart refusal, and pinned Pi 0.85.1 `get_state` in disposable HOME. No provider prompt was sent. These same-UID fixtures do not prove real daemon stop/crash, two mapped UID isolation, escaped native tool absence, or history settlement.

Clean committed-tree gate at adoption revision `90ada7f0d2974fa9b9756832085ba5f0e5e0205b`: `PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH TMPDIR=/var/tmp ./scripts/ci-local.sh --clean --json` passed (`status:passed`, `clean:true`). The previous branch's clean gate passed at `821ee35`. Neither gate proves a usable controller or daemon crash/restart settlement. No acceptance box in `item.md` is completed; this issue remains open/in-progress, not testing or done.

Before HTTP/SSE/browser wiring: prove disposable-user daemon stop/crash and native history reconciliation; establish known owner and single-writer fencing (including terminal TUI and restart), positive old-writer absence and settlement before deliberate resume; add authorization and CSRF, command ledger with uncertain status and no automatic retry, HTTP/SSE replay/backpressure, browser reconnection, production interaction and visual evidence, and real-agent test with the user's participation. The gate and this inert intermediate are not substitutes for those proofs.

## Selective inert ownership adoption (2026-09-28)

Adopted only the code and same-UID synthetic tests from preserved `0cdbaa5` / `b650610` as `6ae19df` (not a raw merge); preserved branch `wt/3e0ertcs6m-pi-control-ownership-proof` is unchanged. The private, unexported `acquirePiOwnership` obtains an advisory per-UID/session flock on a checked private inode and `launchPiRPCWithOwnership` passes the descriptor to its direct child. `reconciledNativeHistory` double-reads native JSONL and rejects missing, changed, wrong ID/cwd/UID history. It does **not** authorize resume. Source search of all Go files found `launchPiRPCWithOwnership`, `acquirePiOwnership`, and `reconciledNativeHistory` only in this private code and tests; `launchPiRPC` is likewise used only by tests. There is no production caller, HTTP/SSE/gateway/browser route, new privilege, or user-facing control. Existing sessions and restart resume remain denied, external terminal TUI is not fenced, and termination remains unknown even after direct-child reaping. A flock is advisory, not proof of old-writer or detached-tool absence.

At `6ae19df`, `TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH go test -race ./internal/daemon -run 'TestPi(Ownership|RPC)' -count=1` passed. The synthetic same-UID tests cover live-lock exclusion, crash of a fake launcher process, released lock after direct-child death, rejection of symlink lock, missing history, and graceful-close uncertainty. They do not prove disposable mapped-user daemon/systemd stop/crash cleanup or old-writer absence. One independent final-diff concurrency/security review: deepseek-v4-pro returned no response (no opinion); gemini-3.8-flash completed and reported no concrete finding. No finding was filed. This review does not establish external TUI exclusion or production safety.

Before any user-facing path is added, prove disposable-user daemon/systemd cleanup and positive old-writer absence and native settlement separately. No browser capability acceptance box is checked; issue remains open/in-progress. No deployment performed.

Clean committed-tree gate at `b334d3b`: `PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH TMPDIR=/var/tmp ./scripts/ci-local.sh --clean --json` exited 0 (`status:passed`, `clean:true`). This gate includes the adopted code, tests and preceding evidence text; it proves neither mapped-user/systemd lifecycle nor browser control. This receipt-only paragraph changes no runtime behavior.

## Private RPC event/acknowledgement increment (2026-09-28)

At `090e255`, the still-unexported, unmounted Pi RPC transport separates correlated responses from native events. Events arriving before acknowledgement no longer poison a valid prompt; a full bounded event queue instead poisons the channel and prevents a later request from claiming certainty or retrying on that channel. Malformed/oversized JSONL fails closed. This is **not a browser controller**: there is still no production call site, no HTTP/SSE route, no gateway forwarder, no connected UI, and no browser-owned session. Previous read-only terminal histories remain read-only. No acceptance box is complete and this issue remains open, not testing.

`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH go test -race ./internal/daemon -run TestPiRPC -count=1 -v` passed at `090e255` (including pinned Pi 0.85.1). The added native test starts the actual pinned CLI under a disposable HOME/cwd with only synthetic environment variables, an invented model and API key, and a loopback OpenAI-compatible provider. It sends one prompt, observes correlated acceptance and `agent_settled`, then reads Pi's own JSONL via the production native reader and finds the synthetic assistant reply. Ten repeat runs of the native-provider and event-overflow cases passed. No real credentials, OAuth, test-host installation, or public browser routes were used. These tests do not establish mapped UID separation or service crash cleanup.

Independent focused security/runtime review of the diff: Claude Fable 5.1 invocation failed without an opinion; Gemini 3.8 Flash found no concrete defect; GPT-6 Astra independently probed acknowledgement/event-loss false negatives and found none. Local `go test -race` and pinned Pi source checks supplied the executable evidence; the review does not approve a future HTTP controller. No finding met the filing bar; no new issue filed.

**Next exact walking slice:** bind a fresh Pi session to one verified mapped workspace and daemon-owned controller, enforce Pi onboarding and per-UID capacity, and expose a bounded authenticated/CSRF-protected create/send/status route through the gateway; read Pi's native history on reconnect without retrying uncertain sends. Add SSE or bounded resnapshot of live events, production UI interaction, cross-UID synthetic browser tests and disconnect/crash evidence before calling it a usable browser conversation. Visual evidence and Jari's verdict belong after this path exists, not in this private-transport increment.

Clean committed-tree gate at `3a68d3d`: `PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH TMPDIR=/var/tmp ./scripts/ci-local.sh --clean --json` exited 0 (`status:passed`, `clean:true`). This gate includes the private transport code and its tests, not a browser controller; this receipt-only addition makes no runtime change.

## Mapped-UID private conversation controller increment (2026-09-28)

A new daemon-only `/api/v1/conversations` handler is mounted on the existing
pre-opened per-UID Unix listener, behind `TrustedPeer` and the same-user Pi
onboarding check. It has **no gateway forwarder, public route, contract or UI**.
It creates only fresh Pi `--session-id` sessions in a freshly discovered,
openat2-verified workspace; it rejects stale/replaced workspace inodes. It
launches the pinned Pi CLI bundle (not the SDK export), owns one native RPC
child per conversation independently of HTTP requests, uses correlated native
acknowledgements, records pending/accepted/rejected/uncertain, and rejects
repeated command IDs without retry. GET list recovers in-memory handles after
lost create responses; GET status gives a capped live event tail, loss marker,
and freshly read native Pi JSONL revision/history query. Stop and exit report
uncertain termination, never confirmed tool cleanup. Limits: four live children,
128 lifetime session handles, 128 command IDs per handle, 64 retained events
per handle and truncated large event views. Revocation/shutdown closes handles;
terminal history remains read-only and restart never authorizes takeover.

The next gateway slice must add explicit `/api/v1/conversations` create/list,
`/{id}/send`, `/{id}/status`, `/{id}/stop` authenticated+CSRF-checked forwarders
that synthesize daemon identity headers (never forward browser identity), bound
request/response bodies, and map lost requests to uncertainty; then add the
browser interaction and browser disconnect/reconnect evidence. The controller's
wire shape is deliberately private and **not** a published v1 browser contract.
The live event tail is a bounded status resnapshot, not SSE replay. Command IDs
are unique only for this daemon lifetime, so after a crash the native history
is read-only and outstanding sends remain uncertain. No cross-terminal/two
independent-writer support, automatic retry, generic cgroup, or confirmed native
tool termination is claimed. No real home/credentials, OAuth, live host, or
root service was touched. No acceptance criterion checked; issue stays open.

At implementation revision `ec3fd75`,
`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH go test -race ./internal/daemon -count=1`
passed (including the pinned Pi 0.85.1 synthetic-provider prompt through the
production CLI bundle, a replaced workspace inode, a disconnected send and
duplicate command ID, spontaneous direct-child exit while a detached synthetic
stdout holder remained, private identity denial and revocation). A preceding
five-repeat focused run passed after fixing a flaky synthetic holder fixture.
Existing crash-lock tests use a synthetic helper process, **not** the real
systemd mapped-user service. No cross-UID controller guest, actual service
crash/systemd cleanup, browser gateway, OAuth, or live host was tested in this
increment. The independent security/runtime review used gemini-3.8-flash
(incomplete response, no final verdict) and gpt-6-astra (three concrete
findings). The latter's SDK-module launch error, discovery-to-open inode race
and spontaneous-exit FD leak were reproduced or validated against source and
corrected before the final test. No residual review finding met the filing bar;
no issue was filed.

At committed revision `ec3fd75`, clean-tree gate
`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH ./scripts/ci-local.sh --clean --json`
passed (`status:passed`, `clean:true`), including package release verification.
The receipt paragraph is documentation only; it does not change runtime code.

## Gateway-only conversation forwarding (taskfleet 01m3mx0v8f9pf50geysy8d21ss)

Gateway routes are mounted for authenticated browser sessions: `GET/POST
/api/v1/conversations`, `POST /api/v1/conversations/{uuid}/send`, `GET
/api/v1/conversations/{uuid}/status`, and `POST /api/v1/conversations/{uuid}/stop`.
This remains a **private provisional protocol**, not a published `contracts/v1/`
browser capability or completed UI. Requests have no query parameters or alternate
paths; create takes exactly `{"workspace_id":"ws_..."}` (bounded 1 KiB), send
takes exactly `{"message":"...","command_id":"<fresh UUID>"}` (bounded 66
KiB, message <= 65,536 bytes), and list/status/stop take no body. Writes require
the current `/auth/session` CSRF value and exact origin; a CSRF token from another
session cannot be replayed. Only server-synthesized identity, display name and a
one-way session digest reach the daemon; browser cookies/identity headers do not.
A broker authorize recheck precedes every socket dial; socket path/mode and peer
are checked under the same rules as the other gateway forwarders. Replies are
bounded, parsed and reduced to validated JSON; error text is never reflected.

The gateway keeps a transient browser-session-to-conversation-ID lease table so
one browser login cannot operate another's daemon controller. Its loss on
restart, logout, expiry or a lost *create* acknowledgement **does not confer a
claim to the orphan**: list hides it and a new session cannot control it. The
lost create returns `503 control_uncertain`, not permission to retry; a UI must
recheck the list, and if it cannot find the handle, tell the user that control
is unknown rather than creating again. A lost *send* acknowledgement on an
already known handle returns `503 control_uncertain`; poll that handle's status
and native history, and **never automatically resend**. Stop returns
`termination_unknown`, not proof that detached native tools stopped. The daemon
still owns the process and may continue after browser disconnect. The list is
filtered to current-session known handles, not a recovery registry. A gateway
restart intentionally sacrifices control of in-flight children, pending a
future explicitly designed durable/recoverable ownership protocol; native
history remains read-only. Multiple gateway replicas are not supported by this
in-memory lease mechanism. The daemon ignores the session digest, so the
browser-session boundary resides in the gateway, not in the per-UID daemon.

Tests use synthetic Unix listeners, browser sessions and broker mappings;
no real credential/home, installation, browser proof or live host was used.
Focused race tests cover forged identity headers, second-session ownership,
wrong peer, CSRF, anonymous requests, malformed paths, lost create ack and
status/send/stop. Independent review by gpt-6-astra found a slow-body logout
race and HTTP/2 ingress rejection; both were corrected before the gate.
gemini-3.8-flash returned only incomplete reasoning (no verdict). No residual
review finding met the filing bar. No acceptance box is checked; issue remains
open until UI, reconnect/disconnect, actual mapped-UID guest and real-agent
browser evidence are available.

At committed revision `f99fff0`,
`PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH TMPDIR=/var/tmp ./scripts/ci-local.sh --clean --json`
exited 0 (`status:passed`, `clean:true`) on its third attempt, including package
verification. The first two attempts stopped at transient npm download
`ETIMEDOUT`, before reaching project checks. This receipt-only paragraph changes
no runtime behavior; neither the gate nor the synthetic tests establish a
real mapped-UID guest, browser proof or live-host behavior.

## Browser conversation UI intermediate (taskfleet 01m3my1yeeb974drfy75xmfpb4)

A production-component UI on verified workspace routes now lists current-login leases, creates one fresh session, sends a single UUID-tagged prompt, polls bounded status/event tails and reads native history through the existing read-only history API. It binds writes to `/auth/session` CSRF and exact Origin, validates capped JSON before rendering, persists per-login drafts and ambiguous request markers in tab session storage, and does not retry an uncertain create/send. A synthetic TLS browser host mounts a fake conversation daemon handler behind the **real gateway** for browser tests of create/send/reconnect, lost create/send acknowledgement and old terminal-history read-only behavior. The fake has no Pi process or new native history. The real mapped-UID daemon code is unchanged. Evidence and screenshots are in `visual-acceptance.md`.

**This is not functional acceptance.** The browser-host fixture uses two invented identities on the *same UID*, no real Pi prompt, native JSONL for a new session, real event stream, daemon restart or cross-UID proof. Resnapshot is polling (no SSE), event history can lose a bounded tail, and a new browser conversation cannot resume after gateway/daemon restart. On the app's 30-second session revalidation the conversation component remounts: the draft is restored, but focus and a previously loaded history page/reading anchor are not guaranteed. Rich queue, supported user questions and interruption of individual Pi turns are not connected by the provisional API. These are exact remaining blockers for the accepted core; leave the issue **open/in-progress**, with no criterion checked and no deployment or real OAuth. Jari's visual verdict is pending.

At baseline revision `00dd7db`, `PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH TMPDIR=/var/tmp ./scripts/ci-local.sh --clean --json` passed (`status:passed`, `clean:true`); focused browser tests passed with three cases. A post-gate visual/security pass found that the existing generic read-only banner contradicted the separate agent-control authorization, the accepted/rejected status was not explicit, and screenshots of the scrollable main pane cropped out the actionable state. The follow-up edits scope the banner to workspace mutations, show explicit rejection/uncertainty, add malformed-status failure coverage, and capture visible control state. No review finding met the bar for a new issue; the UI remains deliberately incomplete as stated above.

At final implementation revision `1a296f7dc87d38f6efae1a606aeb26452f91717b`, the same clean-tree gate exited 0 with `status:passed`, `clean:true`, including four synthetic browser conversation cases, all existing browser suites, Go race tests and release verification. This does not prove the remaining real-Pi, separate-UID or focus/anchor acceptance listed above. This receipt-only paragraph changes no runtime behavior.

The static two-UID routing fixture was selectively harvested from preserved `wt/xpckyhjkv5-real-mapped-pi-browser-proof` (fixture repairs `428c8c4`, `dd57fc0`, `af1ede1`; no raw merge or controller harness). At committed `4d3dd30640a91f3d99a4858d3c28528923fa6186`, `TMPDIR=/var/tmp bash test/vm/test-vm-test.sh` passed, `TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH ./scripts/vm-test.sh two-user-routing --json` passed in disposable PID1 QEMU (223 guest seconds; UIDs 21001/21002 plus gateway 21003, isolated snapshots, socket/peer and cross-home denials), and the same environment's `./scripts/ci-local.sh --clean --json` passed (`status:passed`, `clean:true`, including package verification). The guest's root-owned selector points only to a synthetic Pi *status* stub; it neither executes pinned Pi nor creates native JSONL, and no selector or fixture assets were added to the production package. No real home, credential, provider account or live host was touched. Routing alone does not prove browser-to-mapped-Pi control; the issue remains open with its acceptance boxes unchecked.

## Rootless real-Pi controller proof (taskfleet 01m3n2hdjn06tgf4w62kygcz11)

On baseline main `307e55b`, the opt-in `TMPDIR=/var/tmp
./scripts/test-real-pi-controller.sh` passed in a disposable rootless Podman
container with `--network none`. Offline preflight verified Node 22.21.1
archive SHA-256 `680d3f30b24a7ff24b98db5e96f294c0070f8f9078df658da1bce1b9c9873c88`
and Pi 0.85.1 archive SHA-256
`396b0d8490b427dec858162977ca2ef202da87ed5415a85840a6553fad2d4306`
from `/var/tmp/nah-pi-release.3aWTlikb`; the prerequisite rootless Podman
image was already cached and is required offline. The script built the **product
CLI**, not a fixture-enabled product build. No machine install or production
change was made; all root changes happened inside the disposable user namespace.

Two product daemons ran as distinct mapped kernel UIDs 21001/21002, the product
TLS gateway as UID 21003; their root-owned pre-provisioned bindings, private
homes, socket ACLs, file ownership and peer checks were exercised. A root-owned
**static broker protocol fixture**, not the real provisioning broker, answered
canonical synthetic identity routes; real gateway OAuth/PKCE/state/session/CSRF,
identity mapping and UDS forwarding ran against a synthetic HTTPS loopback
GitHub fixture with invented tokens and fake native gh/git. Pinned Node ran
Pi's real status helper and Pi's real RPC CLI with per-UID synthetic OAuth and
an offline OpenAI-compatible loopback model. Both UIDs created fresh browser-
owned controllers, sent one UUID-correlated prompt each, observed `accepted`
ack and `agent_settled`, and read each new Pi JSONL reply via the authenticated
gateway history route. The first browser dropped its send response over TLS;
status/history reconciled without resending (two model requests total). Tests
also denied bad CSRF, anonymous and cross-browser handles/history, forged
identity headers, cross-UID homes/sockets, root peer and OAuth state replay.
A direct daemon-A restart lost its controller handle but retained read-only
native history; no prompt was resent. This is a request-level disconnect
fixture, not a rendered browser reconnect test. The container proof was run
twice after final fixture changes and passed both times.

**Limits:** No Chromium/visual review, consented real provider, real OAuth
identity, real root broker JIT/verification, systemd socket activation/service
stop/crash or live test-host behavior was exercised. A rootless container
restart does not prove systemd KillMode cleanup or in-flight daemon-crash
settlement. The old QEMU TCG attempt exceeded the 3-second production Pi
status deadline and remains a **failed** QEMU proof; this new faster container
proof does not make that guest pass. No test-host deployment. Keep this issue
**open**, pending Jari's visual review and a consented real-provider walking
story; do not mark full acceptance from this synthetic proof.
