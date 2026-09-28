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
