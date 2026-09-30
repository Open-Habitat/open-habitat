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

At committed fixture revision `2ae11ec3a54b313e3308628245a2b89abcb00041`,
`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH
./scripts/ci-local.sh --clean --json` exited 0 (`status:passed`,
`clean:true`), including release packaging and verification. This receipt-only
addition changes no executable code or tests. There was no production-code
diff to security-review, and neither the gate nor package verification proves
the host-specific broker/systemd/live-host boundaries above.

## Browser revalidation reading-place repair (taskfleet 01m3n3g606ch32ev1nwmc6hjdm)

The 30-second App session revalidation still removes the old snapshot before requesting a new one; it does not keep old identity facts visible under a changed cookie. BrowserConversation now saves only ephemeral presentation state in App memory before unmount (loaded native pages and cursor, unread count, scroll offset, editor focus/selection). It restores that state only after the fresh snapshot, same web identity, same workspace/conversation, same CSRF token and a fresh conversation lease list all agree. It does not persist pages or focus in sessionStorage, confer control from cached content, retry an uncertain command or keep a controller alive outside its route. On logout, changed identity or revoked Pi the cache is discarded. Poll and focus listeners are removed when the component leaves its route. Existing draft storage remains login-scoped.

Production-bundle Playwright against the synthetic TLS browser host exercised the actual 30-second timer with a controlled clock: 50 loaded entries, scroll away from the bottom, a selected substring in a nonempty draft, revalidation and a new live status tail. Focus, selection, draft, loaded pages and scroll survived; a subsequent new native-history entry was signalled as unread without jumping, and leaving for settings produced no further conversation status polls over another 30 seconds. Four other browser conversation scenarios also passed. The synthetic test intercepts status/history responses and is **not** real Pi, a real provider, visual approval, separate mapped UIDs or a live host. It models a first-page response containing a new entry; incremental detection beyond the first history page remains limited by the provisional paged API. No live host/OAuth/real home was touched. Issue stays open pending Jari's visual verdict and consented real-provider story.

At committed revision `32147dd`, `TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json` exited 0 (`status:passed`, `clean:true`), including the full browser suites and release verifier. The first gate attempt stopped before checks on a transient npm `ETIMEDOUT`; the retry passed. Focused final-diff review checked identity/CSRF scoping, aborted refreshes, route timer cleanup and non-retry behavior; no review finding met the filing bar. This receipt adds no runtime behavior.

## Native turn-abort intermediate (taskfleet 01m3ryav5nytnq1hd5as623hpk)

The browser's “interrupt Pi turn” button previously called `stop`, which terminated
its entire Pi child and reported unknown tool termination. It now sends one
UUID-tagged `abort` RPC through authenticated, CSRF-checked gateway forwarding.
The daemon admits abort only on a live accepted turn, spends the command ID before
writing, rejects replay and concurrent abort, and reports pending followed by
Pi's correlated accepted/rejected/uncertain acknowledgement in status. Browser
network ambiguity is not retried. Pi's process and native history remain owned
by the same controller; abort is **not** evidence detached tools stopped or that
history settled. `stop` remains a separate private API. Only one browser lease
can access the handle and terminal histories remain read-only.

This is an intermediate slice, not issue completion: SSE, ended-browser-session
continuation, rendered real-Pi browser journey, and real-provider acceptance are
still pending. Synthetic fake-Pi and same-UID gateway tests establish abort
routing and acknowledgement/replay semantics only; distinct-UID Pi proof from
prior slices does not cover this new abort route. No live host or real credentials.

Final-diff review correction for this increment: Claude Fable 5.1 identified
three actionable abort-path defects; GPT-6 Astra independently checked their
premises against pinned Pi 0.85.1 and the revised code. Pi waits for idle before
acknowledging abort. The controller now allows up to 30 seconds, and on abort
expiry poisons further writes **without closing stdin**, so a slow Pi can still
settle native history; its control remains uncertain and cannot be reused.
Concurrent steer/follow-up/queue-clear are rejected while abort is in flight,
preventing an abort-delayed clear from losing the only returned queue texts.
The browser keeps a login-scoped, presentation-only abort ID so accepted,
rejected and uncertain abort acknowledgements use interruption-specific text
across revalidation rather than send-receipt text; it never retries the abort.
These fixes do not make a slow or detached native tool safe to resume, nor do
they prove a gateway response can never be lost on unrelated transport failures.

At candidate `3a7780b`, focused checks passed:
`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH
go test -race ./internal/daemon ./internal/gateway -run 'Test(Conversation|PiRPC)' -count=1`,
`./scripts/test-web-fast.sh`, and pinned Pi 0.85.1 synthetic-provider
`TestPiRPCNativeSyntheticProvider` (idle abort followed by `get_state` in the
same child; this does **not** exercise active native tool cancellation). A
same-UID fixture test delays abort and checks queue-clear denial, while a
separate short-deadline transport test checks that an ambiguous abort does not
close the child stdin. These do not prove browser-rendered native abort.

The optional distinct-UID `TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh`
first failed before the scenario because the product gateway now requires a
root-owned private revocation socket activated as FD 3; the older disposable
fixture had not supplied one. The fixture now supplies only that root-owned
0600 listener, not a substitute gateway. Its rerun passed in rootless networkless
Podman with mapped UIDs 21001/21002 and gateway UID 21003, pinned Pi 0.85.1,
two synthetic-provider prompts, request disconnect/no retry and restart history
read-only. The script does **not** invoke the new abort route, systemd or a real
provider. The failed preflight is superseded for the old scenario only; no
cross-UID abort claim is made.

Final committed runtime candidate `82e817c` passed
`PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH TMPDIR=/var/tmp NAH_PORT_BASE=15000 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`
(`status:passed`, `clean:true`, including production browser journeys, Go race,
contracts and release packaging). Earlier clean-gate attempts were stopped to
repair review findings and the UID fixture; one attempt reached Playwright but
failed because an interrupted run had left Vite listening on port 14709. The
orphaned worktree-local listener was stopped, and the complete gate passed on a
fresh port range. This receipt-only change does not change runtime or packaged
inputs, so the successful clean-gate result is reused. The gate does not prove
SSE, ended-session continuation, live provider, or browser-rendered real-Pi abort.
Leave `@build-agent-control` open/in-progress with no acceptance criterion
claimed from this intermediate slice.

## Provisional conversation status stream (taskfleet 01m3seftbn3dhnpwzm4axbvpr4)

Selectively harvested the seven-file uncommitted SSE patch from the failed run
`01m3s01ys4kqdgqnjhjcc66mkb` into this fresh branch. Its preserved worktree
and patch (`dc7f34eb41b5d4c4c823cb687339a8be32aa83e5c912c9b16789fdb07f56193a`)
were inspected but not modified or merged. The adopted slice provides a private
`GET /api/v1/conversations/{id}/stream` for a current browser-session lease:
each SSE frame is a validated *status resnapshot* backed by native Pi observations.
The daemon verifies Pi onboarding again before each frame; the gateway checks
broker authorization, the current browser session and handle ownership before
releasing each frame. Browser status and native-history HTTP reads remain the
fallback; an ambiguous send is never retried. Browser route unmount closes its
EventSource. A disconnect leaves the mapped user's Pi child running.

This stream is **not** the combined event/replay contract in `docs/interfaces.md`
or `contracts/v1/`: it has no missed-event replay or `after` snapshot handoff.
Its `ev1:` ID scopes the ephemeral status cursor to one daemon incarnation,
but the current browser intentionally reconnects with a fresh EventSource and
resnapshots rather than claiming gap-free replay. The `Last-Event-ID` validation
path is available to other clients and rejects foreign/future cursors; it does
not turn this private channel into the published replay API. The browser's
three-second HTTP poll resumes when the stream fails and relaxes to 15 seconds
while it is open. Each finite connection runs for at most 20 seconds, emits at
most 20 frames on a two-second tick, each at most 1 MiB. Gateway response
headers are limited to 8 KiB; its scanner permits at most 20 bounded frames,
with 27-second socket and 26-second browser-write deadlines. The daemon's
absolute write deadline is 24 seconds. Non-200 daemon errors use bounded,
validated JSON and are never forwarded raw. These bounds do not establish a
host-wide multi-user load benchmark.

At final runtime commit `919866c9cc3cd0088e28e8fc63b5ba98a31d8ae6`,
`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH NAH_PORT_BASE=18400 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`
exited 0 (`status:passed`, `clean:true`; full Go race, browser, contract and
package checks). The same clean gate passed at the earlier runtime commit
`c47e3c8` on port base 18100, but that result was superseded after review
corrections. Focused Go race conversation/header tests and `test-web-fast.sh`
passed after the corrections; the pre-correction focused browser suite passed
20 cases including a stream response and HTTP fallback when the stream is
unavailable. `TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh` passed
against distinct disposable mapped UIDs 21001/21002 and gateway UID 21003,
pinned Pi 0.85.1, and a synthetic provider; this pre-correction scenario did
**not** exercise SSE. The full gate's browser host also uses synthetic fixtures,
not distinct kernel UIDs. No real home, account, live provider or deployment
was used.

Independent Claude Fable 5.1 review of `c47e3c8` identified excess per-frame
resource work, an unused browser reconnect cursor and a daemon-error mapping
bug. The bounded cadence/poll correction and validated error mapping landed in
`919866c`; review of that final diff found no remaining release-blocking
security or correctness defect. Remaining efficiency and provisional replay
limitations are documented above, not filed as speculative new issues.

The failed run did **not** implement deliberate continuation of an ended browser
conversation, and this harvest did not add it. Nor does this receipt establish
the published SSE event/replay contract, a rendered real-Pi browser journey,
real-provider acceptance or Jari's visual verdict. Leave
`@build-agent-control` open/in-progress; do not mark its acceptance complete.

## Provisional stream gap rejection (taskfleet 01m3snj56qfh0t14tyd429hmz8)

This is a deliberately **partial** server-side slice, not the requested replay
or ended-conversation continuation. The current finite per-conversation status
SSE stream has no event ring and cannot replay a missed frame. Previously an
old `Last-Event-ID` silently received a fresh frame with a jumped sequence;
now every already-used cursor gets `409 cursor_expired` before SSE headers and
the gateway preserves that validated code. Even the latest cursor is not
replayable: parallel viewers can each advance the provisional frame counter. A cursor from another daemon incarnation returns
`409 cursor_instance_mismatch`; future or malformed cursors remain rejected.
A client must fetch current status and native Pi history after a gap, never
interpret a fresh resnapshot as a replay. The production browser currently
opens a new EventSource without a cursor and falls back to HTTP polling; this
change does not supply its eventual reconnect/replay implementation.

**Browser request for night:ui:** Do not treat the private `status` stream as
the published `/api/v1/events` contract. On stream failure or a 409 cursor
error, read status and `/api/v1/agents/pi:<id>/history`; never resend an
uncertain prompt automatically. The browser needs an explicit affordance to
continue an ended browser-owned conversation only after the daemon exposes a
safe continuation route. Existing terminal history remains read-only; a
readable history after daemon restart does not authorize continuation.

This slice does not start a new Pi process over native history, prove writer
absence after stop, implement the daemon-wide snapshot/`after` handoff or
replay ring, or run a rendered real-Pi browser journey. No live provider, real
home, deployment, or Jari visual verdict. The issue remains **in-progress**.

At candidate `305292b`, the exact requested clean-tree gate with
`NAH_PORT_BASE=18600` exited 0 (`status:passed`, `clean:true`). This is
superseded for the final diff by the review correction below. The distinct-UID
`TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh` also passed (rootless
Podman, pinned Pi 0.85.1, synthetic provider, UID 21001/21002/21003), but the
fixture does **not** exercise this stream or a continuation path; it proves only
the unchanged create/send/restart-read-only journey. Focused
`go test -race ./internal/daemon ./internal/gateway -run 'TestConversation(Stream|Gateway)' -count=1`
passed after the correction.

Independent review level: Claude Fable 5.1 finder found a real concurrency
problem in the first candidate's exception for an immediately preceding cursor:
concurrent viewers can advance the shared counter between the check and the
first frame, giving a false continuity claim. We removed that exception and
reject every used cursor, even the latest. GPT-6 Astra independently checked
the revised authorization and cursor paths and found no remaining concrete
finding. No issue was filed; the published replay and continuation work remain
in this open issue, not disguised as a completed capability.

## Ended browser conversation continuation (taskfleet 01m3spz5wm8rr136atrn7kex10)

Harvested the two preserved provisional-stream commits `305292b` and `a35dbb7`
without touching their original worktree. The private status stream now rejects
all replay cursors (409 before SSE headers); there is still no replay ring.

An explicit empty-body `POST /api/v1/conversations/{session-id}/continue` now
reopens the **same** Pi session using the pinned CLI's `--session <path>`.
The gateway requires the same authenticated browser-session handle, broker
binding and CSRF as other writes; another browser login or mapped UID cannot
claim it. A terminal-originated history has no browser-origin marker on the
private owner-lock inode and cannot be continued. The daemon reacquires that
inode non-blockingly; a live direct child retains the inherited lock, including
across daemon restart. For an in-memory child, it also requires the reaped
signal. It resolves the current workspace descriptor, checks the marked
workspace/cwd, and double-reads native history before spawning. A held lock
returns `writer_conflict`; an unmarked terminal history returns
`read_only_history`; unsettled or mismatched native history returns
`control_uncertain`. The new child inherits the lock until it exits. The
response reports `prior_outcome: uncertain`: a previous send or detached tool
is not asserted to have finished, and no prompt is resent. Gateway restart
loses the browser lease and therefore fails closed rather than adopting a
native history.

### Browser request for night:ui

Use explicit `POST /api/v1/conversations/{session-id}/continue` with CSRF and
**no request body** after an ended browser-owned conversation. Success is
`{schema_version:1,agent_id:"pi:<same-id>",workspace_id,state:"idle",prior_outcome:"uncertain"}`;
then read status/history and let the person choose whether to send a new prompt.
Do not retry an uncertain prior send. Show `writer_conflict` as an active or
unproven writer, `read_only_history` as terminal history that cannot be
controlled, and `control_uncertain` as history/workspace not yet safe to
continue. A 503 after writing the continuation request is also uncertain:
re-read status, never automatically POST it again. No browser code changed in
this server-side slice.

Pinned Pi 0.85.1 synthetic-provider distinct-UID fixture: end → explicit
continue → send for both users and explicit continuation after daemon restart
passed; live-child writer conflict and foreign handle denial passed. No
real-provider credentials, home, deployment or live browser journey used. The
full clean gate and independent final-diff review receipts follow below.
General `/api/v1/events` snapshot/replay ring, browser controls, and the real-Pi
browser journey remain; leave this issue in-progress.

Final runtime commit `44d6089` passed the exact clean gate:
`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH NAH_PORT_BASE=18600 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`
(`status:passed`, `clean:true`; `/var/tmp/agent-control-clean-gate-final.log`).
The same committed code passed focused `go test -race ./internal/daemon
./internal/gateway -run 'Test(Conversation|PiRPC|PiOwnership)' -count=1`
and `TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh`. The latter uses
rootless isolated UIDs 21001, 21002 and gateway UID 21003, pinned Pi 0.85.1,
synthetic provider and no real user data. It covers two end → continue → send
round-trips, conflicting live writer, foreign handle, absence of browser-origin
marker, restart with explicit lock/history proof, and no automatic resend of
an uncertain initial send. It does not cover real-provider use, detached tool
lifetime, systemd restart, or a browser-rendered continuation journey.

Independent **critical** final-diff review: Claude Fable 5.1 finder with GPT-6
Astra adversarial verifier, after the first green gate, confirmed three earlier
corrections (mutex-narrowed history reconciliation, reaped-owner release and
continuation admission bounds), then found creation still held the controller
mutex across disk work and a continued session inherited the old 128-command
limit. Both were repaired in `44d6089`, without dropping prior spent command
IDs: the bounded in-memory budget is now 4096 per session per daemon
incarnation. The clean gate above passed on that final runtime commit. Review
and `/assess-findings --apply` records are
`history/review-agent-control-final.md` and
`history/assessment-agent-control-final.{json,md}` (local scratch); no
mechanical fix remained to apply, no new issue was filed. No new authority or
native-history copy was introduced.

Earlier attempts did not pass: the first clean-gate invocation had uncommitted
files; the second had an npm registry read timeout (cache seeded from the main
checkout); the third reached browser tests but intermittently failed an existing
workspace button-contrast assertion (85 others passed). A fresh gate passed
before review fixes and the final gate passed after them. The rootless fixture
first used the wrong request method/CSRF for bodyless stop, then passed after
repairing its request helper; a focused test initially reused a consumed HTTP
body and passed after using a fresh request. None of those failed invocations
is counted as proof. The optional model-performance corpus step was not run.

## Shared snapshot cursor and bounded invalidation replay (taskfleet 01m3sszrzjyp781twe94y7g5g4)

This is a **partial server-side slice**, not the full combined structured-event contract. The production daemon now gives `/api/v1/snapshot` and `GET /api/v1/events?after=<cursor>` one daemon-lifetime instance UUID and sequence. The snapshot captures its watermark before native discovery, so native changes during construction remain replayable; a duplicate native observation is harmless because events only invalidate the snapshot. Native Pi RPC events (coalesced to one trailing invalidation per 250 ms) and controller create/continue/exit/shutdown emit `snapshot.invalidated` with the public event schema. An in-memory window holds at most 128 events / 1 MiB; `oldest_replay_cursor` names the predecessor of its oldest event. Another daemon incarnation gives 409 `cursor_instance_mismatch`, expired cursors 409 `cursor_expired`, and malformed or future cursors 400 before SSE headers. `Last-Event-ID` overrides `after`. The gateway maps the browser to its own daemon socket, validates and rechecks session and broker binding on frames and two-second heartbeats. Neither gateway nor daemon keeps persistent events; the former does not issue its own cursors. The existing provisional per-conversation status stream remains unchanged.

**Browser request for night:ui:** Treat this endpoint as invalidation-only for now: use the snapshot cursor as `after`, track the last applied sequence, ignore a duplicate sequence, and on `snapshot.invalidated` or 409 get a fresh snapshot and the relevant native Pi history before allowing writes. Never resend an uncertain prompt. Do not assume `assistant.delta`, queue changes or native `history.entry` are on the combined stream yet; retain status/history fallback and the provisional stream until a complete event publisher exists. A heartbeat is not an event ID. Browser code is owned by night:ui and was not changed here.

The current snapshot's agent `live_tail` is still empty, and history/queue/workspace changes from outside the daemon-owned controller have no event publisher. It is **not** an atomic view at one instant and does not satisfy the CT-003 full delta application claim; activity during a turn is still available through status/history. The ring expires if 128 events arrive during a slow snapshot; the consumer must resnapshot. Finite stream: 20-second lifetime; daemon 24-second write deadline, gateway 26-second write / 27-second socket deadlines, 128 frames (including heartbeats), bounded 1 MiB frames, 8 KiB response headers; slow readers disconnect. The daemon checks native Pi usability at admission and at most every two seconds (also during continuous replay), not by spawning a Node status probe for each frame. Gateway rechecks browser session and broker on every frame. No new store or authority. No deployment, real home or credentials. The issue stays in-progress.

Focused Go race tests and the full clean gate receipts follow in the closing addendum. The separate rootless pinned-Pi synthetic-provider fixture passed, but its existing HTTP create/send/continue/history journey does **not** open `/api/v1/events`; event replay is covered by in-process Go tests, not a distinct-UID stream fixture. Contract schema was not changed: `snapshot.invalidated` already exists in `event.schema.json`; the existing scenario/fixture validator covers it but does not prove the missing structured events.

Review level: independent **critical** final-diff review of first committed candidate `3acf394` by Claude Fable 5.1, with GPT-6 Astra adversarial verification of two source-confirmed findings. Both found realistic load/cursor failures in the first candidate: one fresh Node onboarding probe *twice per replayed frame*, and one invalidation for *every* Pi RPC delta. The first is corrected with admission and bounded two-second native checks even under continuous replay; the second coalesces deltas into a guaranteed trailing user-scoped invalidation every 250 ms while retaining every RPC event in the native controller. A synthetic gateway test now checks consecutive replay and rejection of an unknown event field. See local scratch `history/review-agent-events-replay.md` and assessment. No residual review finding passed the intake filing bar. The review did **not** prove normal-world latency, full structured events or browser use of this stream.

Final committed runtime/contracts candidate `cf8601a` passed the requested clean gate (`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH NAH_PORT_BASE=18600 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`), `status:passed`, `clean:true`, log `/var/tmp/nah-events-final-clean-gate.log`. `go test -race ./internal/daemon ./internal/gateway -count=1` passed after review correction. `TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh` passed on the final runtime code (`/var/tmp/nah-events-final-real-pi.log`), covering the previous distinct-UID native controller story but **not** `/api/v1/events`; event relay/replay was checked with synthetic Go tests. `python3 issues/define-host-contracts/validate_contracts.py` passed with the new invalidation example, so the gate validates that event shape. `/assess-findings --apply` recorded two confirmed findings, both already corrected before application, with zero unapplied clean fixes (`history/assessment-agent-events-replay.{json,md}`). The final gate is repeated on this receipt-only commit below; this paragraph changes no executable code, schemas, examples or packaged input.

## Queue event partial slice (taskfleet 01m3svy0w0qr4ttyfxp1yq30wb)

This is **not** the requested structured live response or mid-turn recovery.
The shared bounded user-UID journal now accepts typed events; validated Pi
`queue_update` observations emit `queue.changed` frames in RPC receive order,
with daemon sequence and event ID. The gateway forwards only validated
invalidation and queue payloads, after its existing per-frame session/broker
checks. It rejects other kinds rather than forwarding unvalidated native data.
The existing provisional status stream and HTTP history/status remain available.
Queue events are not command receipts; an RPC overflow or dropped SSE replay
requires a fresh status/history read. The generic snapshot still has a native
read-only agent fact, not the controller's queue or live tail. No `history.entry`,
assistant/tool deltas, turn, command outcomes, or atomic mid-turn handoff have
been implemented here. External native changes remain invalidations. The
browser cannot yet render a live response from this endpoint alone.

**Browser request for night:ui:** Keep the provisional status and HTTP history
fallback. Treat `queue.changed` as a transient observation, not proof that
steering/follow-up was accepted or removed. On an expired cursor or an
invalidation, resnapshot and read the relevant native history/status; do not
resend an uncertain command. Do not implement delta/tail reconciliation based
on this slice: the snapshot does not carry a controller-owned live tail yet.

The distinct-UID rootless pinned Pi 0.85.1 fixture with a synthetic provider
passed after extending it to read a structured invalidation event over the
real gateway and replay exactly that frame with `Last-Event-ID` for both users.
It does not produce a queue event in this path, or establish browser rendering,
real-provider use, a live host, or cross-UID queue payload delivery. Focused
race tests of the changed journal and gateway pass; full gate and independent
review receipts are recorded below. Leave the issue **in-progress**.

Review and gate addendum for this partial slice: committed candidate `f522523`
passed the exact requested clean gate (`status:passed`, `clean:true`, log
`/var/tmp/nah-structured-clean-gate-retry.log`). The first invocation failed
at the implementation-owner validator because a new CT-036 scenario had no
owner row. We moved that queue assertion into the already-owned CT-004 and
committed it; the subsequent complete gate passed. This was not treated as a
successful partial run. The first full race-package run before the gate also
failed `TestPiDeviceNativeAndOwnership` with native status `unknown` because
the pinned local Pi test dependency was absent; the clean gate installed its
test dependencies and all Go race packages passed. The scenario validator
initially rejected an invalid ID and then a duplicate ID; the final scenario
validated in the gate. The rootless distinct-UID fixture passed on the first
attempt (`/var/tmp/nah-structured-real-pi.log`).

Independent **critical** final-diff review, after the green gate: Claude Fable
5.1 finder and GPT-6 Astra adversarial verifier. One confirmed defect: the
gateway lost its resource-map allowlist when adding queue payload validation;
the guard is restored and a malformed-resource regression test added. The
finder's revision-mismatch observation is not an integration defect: the
published queue event and provisional status are separate protocols, and the
browser only consumes the provisional one. The new shared snapshot remains
read-only and cannot reconcile either revision. Review and assessment scratch:
`history/review-queue-events-final.md`,
`history/assessment-queue-events-final.{json,md}`; `/assess-findings --apply`
applied the one clean fix. No new issue was filed. The corrected code has
focused Go race tests green; its final clean-gate receipt follows below.

Final corrected runtime/test commit `0985610` passed the exact requested full
clean gate (`TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH NAH_PORT_BASE=18600 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`), `status:passed`, `clean:true`, log `/var/tmp/nah-structured-final-clean-gate.log`. This receipt-only edit changes no runnable code, fixture, schema, or packaged input. No deployment or live data was used.

## Positive ended-conversation status (taskfleet 01m3sxhr34qgbkyqc4vycx2qa3)

The private, gateway-validated `GET /api/v1/conversations/{id}/status` now includes `continuation: eligible | writer_present | read_only_history | unproven`. `eligible` uses **the same** daemon proof as explicit `POST .../continue`: a reaped in-memory child (or a free inherited owner fence after daemon restart), browser-origin marker, current matching workspace and settled native history with matching ID/cwd. Status releases the fence before replying; continue reacquires it and holds it through launch. A two-second, cancellation-aware local gate prevents overlapping status probes from impersonating a foreign writer; saturation returns `unproven` in status or 503 for continuation. An actually live child, including one with uncertain RPC outcome, or a fence held elsewhere reports `writer_present`. Terminal-origin history reports `read_only_history`; missing, corrupt or mismatched history reports `unproven`. The status observation is not an admission lease: a race after the reply can still return 409 `writer_conflict`. Prior sends and detached tools remain uncertain, never retried.

### Browser request for night:ui

Use `continuation === "eligible"` from the authenticated current-login status response (or its provisional status SSE resnapshot) as the **only** condition for showing the quiet Continue affordance for an ended browser-owned conversation. Do **not** infer eligibility from `state: uncertain`, `native_history: readable`, or a native history page. `writer_present` means do not offer Continue (the direct child or another fence holder may still write); `read_only_history` means terminal-origin history stays read-only; `unproven` means no verified end/continuation proof yet. On deliberate click, send exactly one empty-body `POST /api/v1/conversations/{id}/continue` with current session CSRF. Admission rechecks proof: handle `writer_conflict`, `read_only_history`, `control_uncertain` and temporary 503, and on an ambiguous network response re-read status/history; never automatically POST again or resend an uncertain prompt. A gateway restart loses the handle; status is 404, not a claim from readable history. Do not treat the provisional status SSE as the published combined replay API. No browser files were changed here.

`go test -race ./internal/daemon ./internal/gateway -run 'Test(Conversation|PiOwnership)' -count=1` passed. The added Go race test checks reaped-child eligibility against admission proof, live child with uncertain state and readable native JSONL, a competing owner lock, corrupt history, missing browser marker, restart with no in-memory controller and missing runtime; gateway tests require and allowlist the field. `TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh` passed on the corrected code (`/var/tmp/continuation-reviewed-real-pi.log`): real pinned Pi 0.85.1 through the production gateway/controller under disposable UIDs 21001/21002/21003, synthetic provider, live child `writer_present`, stopped/reaped child `eligible`, corrupt JSONL `unproven`, unmarked terminal history `read_only_history`, and explicit continuation after daemon restart using the lock/history proof. It does not test a real provider, browser rendering, detached tools, systemd restart or the live host. No real home, credentials or deployment were used.

Independent critical final-diff review after the first green clean gate used Claude Fable 5.1 finder and GPT-6 Astra adversarial verifier. Two confirmed findings (status-probe self-contention and misclassified unavailable source) were fixed in `ed1328e`; a stale mixed-time state observation was not a demonstrated new contract failure and was dropped. Scratch review and `/assess-findings --apply` assessment: `history/review-conversation-ended-signal.md`, `history/assessment-conversation-ended-signal.{json,md}`; both FIX rows were already corrected, so zero clean edits were applied. No filing-worthy residual issue. Final clean gate receipt follows. This is a browser-unblocking server slice, **not** completion of `@build-agent-control`; leave the issue in-progress pending night:ui's continuation gate, rendered real-Pi journey, remaining combined events and Jari's visual/real-provider acceptance.

Final reviewed executable/test candidate `ed1328e` passed the full committed-tree gate `TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH NAH_PORT_BASE=18600 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json` (`status:passed`, `clean:true`; `/var/tmp/continuation-reviewed-clean-gate.log`). Earlier committed candidates `b70824b` and `3e49f41` also passed that gate, but their results were superseded by the reviewed correction. This receipt-only documentation does not change executable inputs or packaged assets.

## Native JSONL history events (taskfleet 01m3sz1qj3xacasjmxcqz4x41w)

**Partial server-side slice.** After Pi reports `agent_settled`, the mapped-UID daemon reads the checked native Pi JSONL and publishes each active-branch native entry as `history.entry` with `native_key` taken from its persistent JSONL `id`, never fabricated from RPC. A repeated settlement in the same controller does not republish a key. Unreadable/unstable history produces `snapshot.invalidated` instead of a false history entry. The existing count/byte-bounded daemon-lifetime replay, cursor errors, session and broker checks, and provisional status stream remain. The gateway allowlists the entry fields and validates the agent resource, key and bounded content before forwarding. No persistent host event store was added.

**Browser request for night:ui:** Treat `history.entry` as authoritative native content keyed by `native_key`; deduplicate repeated native entries by that key, and apply SSE frames only at the next sequence after the snapshot cursor. On a gap, 409, or invalidation, fetch a new snapshot and native history; do not automatically resend uncertain commands. This slice has **no assistant/tool deltas** and the snapshot still reports controller agents from native history with `activity: unknown` and empty `live_tail`. Do not claim a mid-turn snapshot handoff, delta supersession, or live rendering without polling. Keep the provisional conversation status stream and HTTP history/status fallback. A native entry saved after the observed settlement may not publish until another native observation; fall back to native history. The exact intended reconciliation rule and this limitation are in `docs/interfaces.md`.

The distinct-UID rootless fixture now checks an assistant `history.entry` over the real gateway against its native history page's JSONL key and replays the initial frame exactly from `Last-Event-ID` for each of two synthetic users. It does **not** reconnect mid-turn from a `live_tail`, observe deltas, run Chromium or use a real provider. Focused Go race tests check persistent-key and repeated-settlement publication plus gateway payload validation. No deployment, live host, real home or credentials. The issue remains in-progress. Clean gate and independent review receipts follow in the closing addendum.

Independent **critical** final-diff review after the first green gate: Claude Fable 5.1 finder and GPT-6 Astra adversarial verifier. One confirmed issue was fixed: continuation previously replayed all old active-branch JSONL entries into the shared 128-frame ring on its first settlement, evicting other viewers' replay and holding the controller mutex across marshaling. The corrected continuation seeds persistent keys from the checked native file before launch, publishes only entries appended afterward, and narrows the mutex around individual journal frames; a 200-entry regression test verifies the preceding other-agent frame is retained. The finder also raised synchronous native reading in Pi's event-drain loop; the verifier refuted the proposed queued-follow-up trigger from pinned Pi 0.85.1's ordering. A prompt submitted immediately after settlement could still overlap a slow history scan, but realistic overflow timing is unverified; moving publication to a goroutine changes ordering and was not done speculatively. Review: `history/review-agent-history-entry.md`; `/assess-findings --apply`: `history/assessment-agent-history-entry.{json,md}` (ignored local scratch, one FIX requiring coordinated code/test edits, zero mechanical clean edits). No new issue meets the filing bar. The full mid-turn delta/tail work remains for the same in-progress issue.

Final corrected runtime/test commit `c3758d6` passed the requested committed-tree gate with `TMPDIR=/var/tmp PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:/home/maintainer/Sources/native-agent-host/.tools/node/bin:$PATH NAH_PORT_BASE=18600 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json` (`status:passed`, `clean:true`; `/var/tmp/nah-history-entry-reviewed-clean-gate.log`). The pre-review committed candidate `07a736f` also passed, but that result was superseded by the correction. `go test -race ./internal/daemon ./internal/gateway -run 'Test(NativeHistoryEntries|ContinuedHistory|ConversationContinuation|EventsGateway|EventJournal)' -count=1` passed and the corrected `TMPDIR=/var/tmp ./scripts/test-real-pi-controller.sh` passed (`/var/tmp/nah-history-entry-final-real-pi.log`). The fixture's first attempt failed because its newly added SSE reader interpreted the first frame's blank separator as the next frame; the parser was corrected and both reruns passed. That failed attempt is not evidence of product behavior.

The missing live assistant/tool deltas and atomic `activity`/`live_tail` snapshot require a turn-scoped provisional fragment model, bounded coalescing, native-key reconciliation and a journal-locked snapshot handoff. Those are deliberately **not** inferred from this post-settlement history publisher. The required mid-turn synthetic-provider reconnect and rendered browser journey therefore remain unproven, not merely untested. Leave the issue **in-progress** and use the provisional stream plus HTTP fallback until that work is complete. This receipt-only paragraph changes no executable input; the exact clean gate is repeated on this final receipt commit below.

Receipt-only commit `1e7ba3e` passed the same full clean gate (`status:passed`, `clean:true`; `/var/tmp/nah-history-entry-final-receipt-gate.log`). This addition records the receipt without changing runtime code, schema, fixtures or packaged assets. The final-tree gate result after committing this paragraph is reported through the Taskfleet handoff, without another self-referential receipt edit.

## Live controller deltas and snapshot tail (taskfleet 01m3t1a2fq14zkjjk6jk6pnq2f)

The daemon publishes bounded Pi `assistant.delta` and tool progress on the
combined per-UID journal. Text coalesces for at most 50 ms / 4096 bytes; a tool
frame flushes preceding text. The gateway validates and forwards these kinds
under its existing per-frame session, broker and UID checks. The controller's
`activity` and provisional `live_tail` are copied with `event_cursor` under the
journal lock. A new controller-owned conversation appears in the snapshot even
before Pi creates its native JSONL file. Persisted assistant `history.entry`
from JSONL clears the provisional tail atomically with its journal event; the
browser must replace, not append. The ring and tail are bounded, and native
changes outside this controller still use invalidation/history fallback.

### Browser request for night:ui

Read the snapshot, show each agent's `live_tail` provisionally using its event
IDs, then open `/api/v1/events?after=<event_cursor>`. Apply only the exact next
sequence; ignore already applied IDs, and on gap/409/invalidation fetch a new
snapshot and native history. `assistant.delta` text uses `content_index`;
`tool.started` and `tool.finished` use `tool_call_id`; content-free native tool updates are not published, to protect the shared replay window. On an assistant
`history.entry`, discard that agent's **entire** provisional turn tail and
render the native entry keyed by `native_key` instead, reconciling the history
page; never append the persisted text to the deltas. An oversized tail emits
`ring_truncated`, so use the HTTP history/status fallback rather than claiming
an intact live turn. Never resend an uncertain prompt. Retain provisional
conversation status streaming and HTTP fallback; no browser code changed here.

The pinned Pi 0.85.1, rootless distinct-UID synthetic fixture now delays the
second provider turn long enough to observe a real RPC text delta in a
mid-turn snapshot, then resumes from that cursor and observes the JSONL-keyed
assistant entry. It also checks first-cursor replay and isolation of two mapped
UIDs. It does not exercise a native tool-call stream, Chromium rendering, a
real provider, systemd or a deployed host. Native filesystem changes outside
the daemon are not journal-atomic with discovery; observable changes during
snapshot construction trigger a subsequent invalidation, but an unobserved
external write needs a fresh history read. The issue stays **in-progress** for
the rendered browser journey.

Independent **critical** final-diff review followed the first committed-tree clean gate (`993b86b`, `status:passed`, `clean:true`, `/var/tmp/nah-agent-live-clean-gate.log`): Claude Fable 5.1 finder and GPT-6 Astra adversarial verifier. Three source-confirmed defects were corrected: snapshot text flush caused a false native invalidation; child exit/continuation could retain a stale or overflowed tail; content-free tool updates could evict all per-user replay. The fourth candidate, lock-held tail copying, did not establish a realistic stall. Review `history/review-agent-live-final.md` and assessment in ignored local scratch. The corrected distinct-UID synthetic-provider fixture passed (`/var/tmp/nah-live-fixture-reviewed.log`), as did focused Go race tests. No additional authority or store. The final clean gate receipt will be reported at handoff after committing the correction.

## Turn settlement, RPC send receipt and safe incoming question (taskfleet 01m3t3jyvsa3e9w2p5w24jbgf0)

The server now exposes a validated private conversation status with `turn_settled`
(`state`, `observed_at`, `native_key`), `send_receipt` for the latest send, and
`pending_question` (ID, kind, prompt and plain-text choices). Pi fire-and-forget
notifications do not overwrite a response-bearing question. Combined SSE emits
`turn.settled`, `command.changed`, `question.requested` and safe-text
`unknown.native` notifications in the existing
per-UID bounded journal. Settlement is observed from Pi's `agent_settled`, not
assistant `message_end`. It follows the checked native history publication;
without a new assistant JSONL key it says `unknown` rather than claiming a
completed turn. Its timestamp is the host's observation after that history
check, not a Pi-generated timestamp. The private authenticated
`GET /api/v1/conversations/{id}/receipt?command_id=<uuid>` reads any retained
send outcome. This intentionally extends the existing controller instead of
implementing the wider `/api/v1/commands` protocol: only sends are tracked;
other command types retain their existing acknowledgements. The receipt map
shares the 4096 spent-ID bound and survives in-process continuation but not a
daemon restart; missing receipts after restart are uncertain to the browser,
not rejected. No automatic retry. Gateway admission and every SSE frame retain
session/broker and mapped UID checks, and the new payloads are allowlisted.

### Browser request for night:ui

Read `turn_settled.state === "settled"` only with its `native_key` and
`observed_at` to label a completed turn; `unknown` means no proven per-entry
boundary. Use the matching `command_id`'s receipt lookup for a lost send reply
before deciding what to show; a missing lookup or a daemon restart is
uncertain and must **never** cause automatic resend. `accepted` is RPC
acceptance, not completion. Treat `pending_question.prompt` and `choices` as
text nodes only, never `innerHTML`; `unknown` method is deliberately visible.
Pi-specific dialog answer/cancel is not supported. Ordinary messages remain
the only browser write path but **cannot** resolve a Pi extension dialog that
blocks the outer prompt acknowledgement awaiting `extension_ui_response`;
do not show an answer control or claim the dialog was answered. This is a
remaining product limitation, not a completed response workflow. Display
`unknown.native` notifications as inert text.
On a gap/409/invalidation keep the existing snapshot and native history
fallback. No browser code was changed here.

The pinned real-Pi 0.85.1 synthetic-provider fixture exercises acceptance,
receipt lookup, settlement timestamp and native key and their SSE events
through two mapped UIDs; it cannot emit a Pi extension UI request with the
provider alone. A fake Pi RPC unit fixture emits an unknown UI request and an
intermediate assistant `message_end` before `agent_settled`, exercising the
safe-text and unknown-history path; a fake fire-and-forget status update
verifies it cannot replace the question. A focused native-history regression
checks that a newly admitted send fences the previous turn’s slow settlement,
and a gateway regression checks successful tool frames remain replayable. This is not a rendered browser, live host,
real provider, or dialog-answer proof. The issue remains **in-progress**.

Independent **critical** final-diff review of committed candidate `72b25c4`:
Claude Fable 5.1 finder and GPT-6 Astra adversarial verifier. Both source-confirmed
three defects: a successful tool event was incorrectly labelled `settled` and
blocked gateway SSE replay; Pi's fire-and-forget UI updates displaced a genuine
pending question; and a newly admitted send could inherit the previous turn's
settlement after a slow native history read. The corrected code restores
`tool.finished: succeeded`, keeps inert notifications as validated `unknown.native`
plain text (with real `editor`/unknown dialogs still visible), and fences
native publication and settlement by turn generation. The verifier refuted the
finder's additional claim that old publication could clear *new* deltas in
this race: the sole RPC drain loop cannot process those new deltas until the
old native read returns. Review scratch: `history/review-turn-settled-receipts.md`;
assessment: `history/assessment-turn-settled-receipts.{json,md}`. No residual
review issue met the intake bar. The corrected rootless pinned-Pi fixture
passed (`/var/tmp/nah-turn-receipt-reviewed-final-fixture.log`), as did focused
Go race tests; the full corrected committed-tree gate receipt is reported at
handoff.

The first full gate attempt reached its final checks but **failed**, because
`go fmt ./...` reformatted an unformatted committed gateway test, leaving a
dirty tree (`/var/tmp/nah-turn-receipts-gate.log`). The corrected committed
candidate `72b25c4` then passed the exact requested clean gate
(`status:passed`, `clean:true`, `/var/tmp/nah-turn-receipts-final-gate.log`).
That pass predates the review fixes; it does not prove the final reviewed code.
The contract validator initially rejected the new required command ID against
an existing example, so the new field became optional for the older v1 event;
the final validator passed. The first fixture receipt lookup returned 400 until
query handling was fixed; the first focused question test expected a question
to persist after Pi settled and was corrected. None of those failed attempts
is presented as successful evidence. No deployment or real data was used.
