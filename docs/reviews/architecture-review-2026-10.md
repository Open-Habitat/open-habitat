# Architecture review, October 2026: what the caution costs and what it protects

Reviewed tree: `36fe9a1` (main, 2026-10-01). Read-only review for
[architecture-built-on-caution](../../issues/architecture-built-on-caution/item.md).
Scope: `internal/gateway`, `internal/daemon`, `internal/provision`,
`web/src/app` and the state logic in `web/src/components`.

## How to read the verdicts

Each mechanism was judged on three questions: what user-valuable thing it
protects that the Unix boundary does not already protect, what it costs, and
what happens if it is removed. "Keep" rows carry the reason in the row. Where
no reason exists in code, ADRs, `docs/decisions.md` or an issue, the row says
"no recorded reason". Measurements come from three sources and are marked:

- **lab**: `scripts/lab.sh` on alder, one Chromium tab driven by Playwright,
  synthetic daemon and fake Pi on loopback. Request counts are exact; latencies
  are near zero on loopback and say nothing about the server.
- **pilot**: numbers recorded in
  [pilot14-session-revalidation-loop/result.md](../../issues/pilot14-session-revalidation-loop/result.md)
  on the 2 vCPU test server.
- **go test**: `go test -count=1 -v` on alder for the three packages.
- **guess**: marked as such.

Lab baseline, one open conversation, nothing happening, 60 s:

| Request | Count / min |
|---|---|
| `/auth/session` | 12 |
| `/api/v1/conversations/<id>/status` | 12 |
| `/api/v1/events` | 10 |
| `/api/v1/conversations/<id>/stream` | 2 |

Those 36 browser requests become roughly 100 broker round trips per minute on
the gateway, because `authenticated` runs once per plain request, twice per
conversation request, and once per forwarded stream frame or heartbeat (every
2 s on both streams). Each round trip is a UDS connect to the root broker, a
`flock` on the state directory, two file reads and two JSON parses, serialized
across every user on the host. The events stream reconnected every 6 s in the
lab against a designed 20 s lifetime; the cause was not isolated and should be
checked on the server, but the three-fold reconnect rate was reproducible.

Lab tab return (hidden then visible once), 10 s window: 16 requests, of which 6
`/auth/session` and 5 `/status`. The identity mask was visible for 31 ms on
loopback. The pilot measured the same sequence at 3 to 4 s per native read on
the server, so the mask lasted seconds there.

Lab send of one message, 30 s window: 19 history page reads, 5 session reads, 4
status reads, 1 send. No "uncertain" notice was captured by a 100 ms poller, but
the code path that shows it is unconditional (row B9).

Go test wall time: gateway 0.15 s, daemon 9.3 s, provision 7.1 s. The six
slowest tests (2.0 to 2.2 s each) exist to prove fixed deadlines fire.

## Part 1: inventory of defensive mechanisms

### Gateway (`internal/gateway`)

| # | Where | What it checks | When | What it protects, concretely | Cost | Verdict |
|---|---|---|---|---|---|---|
| G1 | `auth.go: authenticated` | Broker `authorize` round trip; route, epoch, generation must match the session | Every session-backed request; twice on conversation routes (`conversation_linux.go:120`); once per stream frame and heartbeat | A subject removed from the allowlist or rebound between two requests. ADR 0006 already gives the operator `RevokeSubject`, which deletes sessions synchronously, and ADR 0006 itself notes the per-request check cannot undo a request already admitted. Epoch equality also means any allowlist rewrite that bumps the epoch logs out every user on the host at their next request; no recorded reason for that behaviour. | ~100 broker round trips per idle tab per minute (lab count, see above); every one holds the broker's directory lock, so users serialize on each other. 2 s broker exchange timeout turns a slow disk into a 401 for everyone. Comment says "Never cache a positive decision"; commit d00cd68 has no message body. | **Simplify**: authorize at login (callback already does ensure + authorize), then trust the in-memory session until expiry or `RevokeSubject`. Remove the per-frame and double checks. |
| G2 | `auth.go: authenticated` second half | After the broker reply, re-read the session map and compare csrf, identity, epoch, generation, absolute | Every request | A logout racing a request. Real but local: a map lookup under the mutex. | Negligible | **Keep** as the single session lookup once G1 is gone; drop the field-by-field comparison, a map hit is the check. |
| G3 | `auth.go: callback` | Three `revoked` checks, broker `ensure` then `authorize` after token handoff, exact epoch/generation comparison | Once per login | ADR 0006 revocation cutoff racing a login; a session issued on a binding the broker changed during handoff | Login only | **Keep**; recorded in ADR 0006. The second `revoked` check (after `ensure`) and the third (at insert) could be one, but it is login-path code. |
| G4 | `auth.go: start` | Per-peer token bucket, 4096 pending flows cap, 5 min flow TTL | Login only | Unauthenticated memory exhaustion of the pending map | Login only | **Keep** |
| G5 | `auth.go: exact`, `callbackExact`, per-route guards | Exact query set, Host, TLS, no fragment, `ProtoMajor/Minor == 1/1`, no body, no transfer-encoding | Every request | Nothing identifiable beyond what `ServeMux` and the handlers do. HTTP/1.1 pinning rejects HTTP/2 on snapshot, history and Pi routes while the conversation route accepts it; no recorded reason for either. | Cheap, but each route repeats a 10-clause condition and each clause carries tests (`auth_test.go`, `snapshot_linux_test.go`). | **Simplify** to one shared guard: method, path, TLS, Host. Drop protocol pinning and body-absence checks. |
| G6 | `auth.go: authorizeWrite` | Origin header equals configured origin; CSRF header equals session token | Every POST | Cross-site writes with the Lax cookie | Negligible | **Keep** |
| G7 | `snapshot_linux.go`, `conversation_linux.go`, `pi_attempt_linux.go`, `github_*`: `udssecure.Mapped` before dial and again after dial, plus peer UID check | Socket owner, group, mode, root-controlled path | Every request, twice | A non-daemon listening at the mapped socket path. The path is root-owned; writing there needs root. The second check after dial protects against a swap in the microseconds between the two stats. | Several `lstat` per request, negligible; the test seams (`snapshotDial`, `snapshotPeerUID`) make the condition a three-way branch in four files. | **Simplify** to one check before dial, in one helper. |
| G8 | `snapshot_linux.go: snapshotOrPiStatus`, `history`; `conversation_linux.go` non-stream; `pi_attempt_linux.go` | Response `ProtoMinor == 1`, exactly one `Content-Type`, exactly one `Content-Length` equal to the body, no chunked encoding, trailing-byte EOF probe, `LimitedReader` with 4096 slack | Every proxied response | A non-conforming response would mean a different program answered on the socket, which G7 already excludes, or a bug in our own daemon. Rejecting it as 502 or 503 does not protect the user; it hides the daemon's answer. The browser validates every body again (Ajv for snapshot, `parseStatus` for status). | ~60 lines per route, five copies; dedicated tests (`snapshot_linux_test.go` 194 lines, `conversation_linux_test.go` 450, `events_linux_test.go` 149) mostly exercise this. | **Remove**. Keep one body size cap. |
| G9 | `snapshot_linux.go` identity binding (`identity_mismatch`), Pi status re-marshalled from a closed vocabulary | Snapshot's `web_identity_id` and `provider_account_id` equal the session's | Every snapshot | The daemon already refuses a request whose identity header does not match its own binding (`validSnapshotIdentity`, `historyAuthorized`). This is a check of a check on our own binary. | Small | **Remove** |
| G10 | `conversation_linux.go: validConversationError`, `validatedConversationReply`, `strictObject`; `events_linux.go: validCombinedPayload`, per-event `DisallowUnknownFields` | Every daemon reply and every event frame re-parsed field by field against an allowlist; errors mapped through a status-code allowlist; unknown code becomes `control_uncertain` or `daemon_unavailable` | Every reply, every frame | The comment claims it stops "a compromised daemon response" reaching "another user's browser". The daemon is the user's own UID; it can only reach that user's browser, through that user's session. A compromised daemon that wants to show the user something simply writes a valid frame. The 502/503 split (`invalidStatus`) exists only to drive the browser's `fail("unavailable")` path, which drops the whole view. | ~400 lines in `conversation_linux.go`, ~200 in `events_linux.go`; any new status field or event kind must be added in three places (daemon, gateway allowlist, browser parser) or it is silently dropped: this is how `auth_error` had to be threaded through in pilot.15. | **Remove**. Forward status, headers and body. Browser parsing stays. |
| G11 | Fixed deadlines: 5 s dial, 5 s snapshot/history/non-stream, 14 s Pi status, 27 s stream socket, 26 s stream write | Every request | A hung daemon tying up a gateway goroutine. The browser already aborts its own fetches (`AbortController`, 10 s in `App.tsx`), and `r.Context()` cancels the proxy when the browser goes away. | Pilot: snapshot took 3.2 to 3.7 s on the loaded server, so 5 s was one load spike away from 503 for every read. No record of what any of the numbers was sized against. Deadline tests cost 2 s each. | **Simplify**: one generous bound (60 s) per proxied request as a last resort; otherwise follow the browser's context. |
| G12 | `conversation_linux.go: forwardConversationStream` | 20 frames max, cursor monotonic, each frame re-parsed as a full status (G10), broker re-auth per frame (G1) | Every stream frame, every 2 s | Nothing beyond G1 and G10. The 20-frame limit mirrors the daemon's own 20 s lifetime. | Lines and tests as G10; per-frame broker trip as G1 | **Remove** with the stream itself (D5). |
| G13 | `events_linux.go: forwardEvents` | 128 frames max, `seq == previous+1`, instance match, per-kind allowlist, broker re-auth per heartbeat and per frame | Every frame and every 2 s heartbeat | Gap detection is already done by the browser (`applyTurnEvent` returns `recover: "snapshot"` on a gap) and by the daemon (`cursor_expired`). | As G10 plus 128-frame cap forces reconnects during fast Pi output | **Remove** validation and re-auth; pipe bytes with a write deadline. |
| G14 | `conversation_linux.go` lease table (`a.conversations`), `ownsConversation` twice, list filtering, create binding under lock | A conversation handle may be used only by the browser session cookie that created it | Every conversation request; list responses filtered | Keeps the same person's second browser or second login from controlling a conversation they started in the first. Not a Unix boundary. The daemon already enforces one writer per conversation (`piOwnership` flock, `continuationProof`) and one controller per UID. The comment calls it "fail-closed on gateway restart": every gateway restart or re-login makes every conversation read-only until the user presses "continue", which is the "Ohjausoikeutta ei löytynyt tästä selainistunnosta" state Jari saw. | ~80 lines, three locked sections, plus browser `list`/`recheckList`/`sessions` state and the "Tarkista keskustelulista" button | **Remove**. The daemon owns conversations per UID; any valid session of that user controls them. This changes a product rule (one browser session per conversation) and needs Jari's decision in the issue, not an ADR. |
| G15 | `conversation_linux.go: validConversationInput` | Strict JSON of request bodies, UUID shapes, 65536 byte texts | Every POST | The daemon validates the same body with `decodeControl` and `DisallowUnknownFields`. | ~60 lines | **Remove**; one validator in the daemon. |
| G16 | `conversation_linux.go` body re-auth ("A slow browser body can outlive logout") | Second `authenticated` after reading the body | Every POST and GET on conversation routes (not only slow bodies) | A logout during a 66 KB upload | Doubles G1 | **Remove** with G1. |
| G17 | `streamHeaderReader` 8 KiB header budget | Daemon response headers | Every stream | Our own daemon sending 8 KiB of headers | 30 lines | **Remove**; `http.Transport.MaxResponseHeaderBytes` exists if wanted. |
| G18 | `revoke.go: RevokeSubject` | Root-only control socket; broker authorize before mutation; sessions and lease entries removed; OAuth serial cutoff | On operator action | Operator removes one person's browser access without restart | None at runtime | **Keep**; ADR 0006. This is what makes G1 unnecessary. |
| G19 | `access.go` Cloudflare Access JWT, `accessEmail` bound into session and flow | Ingress identity equals session's | Every request (string compare), JWT verification per request with cached keys | Test-installation ingress policy; a session cookie replayed through a different Access identity | Small | **Keep** |
| G20 | `uiReturn`, `safe()` fixed error body, `Cache-Control: no-store` | Return-to path allowlist, no reflected text | Login, errors | Open redirect; reflected content | Negligible | **Keep** |

### Daemon (`internal/daemon`)

| # | Where | What it checks | When | What it protects, concretely | Cost | Verdict |
|---|---|---|---|---|---|---|
| D1 | `pi_device_linux.go: validate` → `checkSharedSelector` (`core.LoadSharedPiRuntime`) | Selector file in `/opt` re-read and compared to the startup values | Before every helper spawn (`run`) and in `validate`, which runs in `Start`, `StatusContext`, `create` and `continuationProof` | An operator swapping the Pi release under a running daemon. `docs/pi-runtime.md` already says switching releases requires restarting daemons. | File read and parse per call | **Simplify**: load once at daemon start. |
| D2 | `pi_device_linux.go: validate` → `validateRuntime` | `WalkDir` over the entire pinned release tree checking owner, mode and symlink target of every entry, ancestor chain of three paths, manifest parse, `node --version` subprocess with 2 s timeout | Same call sites as D1 when `TrustedRuntime` | A mapped user making a file in the root-owned, non-writable release tree writable. Only root can do that, and root installed it. `docs/pi-runtime.md` says the operator verifies the installed artifact against a receipt; this re-verifies it per call. | The release tree is ~15 000 entries (counted on the equivalent package tree in `pi-device-test/node_modules`, 157 MB): ~15 000 `lstat` plus one Node process per `create`, per onboarding status, and per status read of an ended conversation (D7). Guess: 50 to 300 ms on the test server per call. This is the same shape as the pilot.14 defect. | **Simplify**: validate once at daemon start; refuse to start if it fails. |
| D3 | `pi_device_linux.go: validate` credential path checks | `~/.pi/agent/auth.json` and parents are non-symlink, owned by the UID, modes tight | Same call sites | The user's own files being readable by others. Pi, not the host, owns those files. | Four `lstat` per call | **Simplify**: check once at onboarding (`Start`), where it can tell the user something. |
| D4 | `handoff_linux.go`, `pi_gate_linux.go` | Pi status helper only on the onboarding status route, 12 s budget | On explicit status request | Onboarding decision | One Node process per status request | **Keep** (pilot.15 decision). Note the gateway's 14 s and daemon's 12 s budgets are sized against the 2.1 to 2.6 s single-run measurement with headroom; fine. |
| D5 | `conversation_linux.go: stream` | 20 s lifetime, 2 s tick; every tick runs `observe` through an in-memory recorder | Every 2 s per open conversation tab | The browser's need for status changes. The events journal already publishes every state change the status carries: `command.changed`, `turn.settled`, `question.requested`, `queue.changed`, `snapshot.invalidated`. | Every tick: `nativeSessions` walks the whole sessions directory reading each file header, `readNativeSettled` reads the entire JSONL of this conversation (twice if the first read looks unstable), then `continuationProof` (D7). Per open tab: one full history read every 2 s, forever. Guess: for a 5 MB history, 2.5 MB/s of file reads per tab. Plus G12 on the gateway. | **Remove** the stream. Serve `status` on demand; the browser refreshes it on journal events. |
| D6 | `conversation_linux.go: observe` native history read | Full JSONL read to produce `native_revision` and `native_history: readable` | Every status request | Whether the native file can be read and which revision it is | Full file read per status | **Simplify**: `stat` for existence and size/mtime as the revision; read the file only on the history route. |
| D7 | `conversation_linux.go: continuationProof` via `observe` | For a conversation whose child has exited: flock probe, D1 to D3, `workspaceFD`, `nativeSessions`, `reconciledNativeHistory` (reads the JSONL twice), 2 s `proofPermit` queue | Every status read and every stream tick of an ended conversation | Whether "continue" would succeed, so the UI can offer the button. `continueEnded` re-runs the whole proof anyway. | For every ended conversation on screen: ~15 000 `lstat`, one Node spawn and three full history reads every 2 s. | **Simplify**: compute `continuation` only on an explicit status request made when the user opens the ended view, and on `continue` itself. Never on a tick. |
| D8 | `events_linux.go: stream` | 20 s lifetime, 2 s heartbeat, `valid()` on every loop iteration and before every frame; `valid()` is `TrustedPeer` plus `validSnapshotIdentity`, and `TrustedPeer` calls `transport.validate` | Every iteration, every 2 s | `transport.validate` does an NSS `user.LookupId` and re-reads the root-owned binding file under `/etc` through an `openat` chain. It protects against root changing the daemon's binding file under the running daemon. Root can stop the daemon instead. Peer UID is read once per connection in `ConnContext` and is the real check. | NSS lookup + 5 `openat` + file read per heartbeat per tab; `historyAuthorized` and the snapshot handler run the same on every HTTP request (17 call sites of `validate`/`ValidateConfig`). | **Simplify**: validate the binding once at startup; per request check only the peer UID from the connection context. Events stream: lifetime 10 min or longer, heartbeat 20 s, validity checked once at open. |
| D9 | `snapshot_linux.go`, `history_linux.go: historyAuthorized` | `X-Agent-Host-Identity` hash and display name equal the daemon's own binding | Every request | The gateway choosing the socket from one binding and sending headers from another. The gateway derives both from the same `Identity` value. | String compare, negligible; but it is a second identity assertion the docs must explain. | **Remove** the headers; the peer UID and the socket are the identity. |
| D10 | `events_linux.go` journal: 128 frames / 1 MiB ring, 250 ms trailing invalidation, 50 ms delta coalescing, 8 KiB per frame, `ring_truncated` | Replay window and frame sizes | Per event | The replay mechanism itself; bounded memory | Design, not defence | **Keep** |
| D11 | `conversation_linux.go: workspaceFD` | `openat2` beneath/no-symlink/no-mount, dev/ino must match discovery | Once per create and continue | A workspace directory renamed between discovery and chdir. Same UID, so not a boundary, but it is one call and gives the child a correct cwd. | Once | **Keep** |
| D12 | `pi_ownership_linux.go` flock + origin marker; `reconciledNativeHistory` double read | One writer per native session across daemon restarts; a continuation only for a browser-started session | On create, continue, and D7 | The product rule "one writer" and no silent takeover of a terminal session. Recorded in `docs/architecture.md` and `interfaces.md`. | Once per create/continue if D7 is fixed | **Keep** |
| D13 | `conversation_linux.go` command IDs: `commands` spent set (4096), `receipts`, `maxConversationCommands`, `turnGeneration` fence | A lost response never causes a second prompt | Per write | Double prompts and double tool runs; the user-visible contract in `interfaces.md` | Small | **Keep** |
| D14 | `conversation_linux.go: drain` message_end scrubbing, `modelAuthFailure` | Provider error text never reaches the browser; auth failure becomes a fixed code | Per RPC event | Secret-bearing error strings in the UI; pilot.15 decision | Small | **Keep** |
| D15 | `conversation_linux.go` RPC budgets: send 15 s, abort 30 s, clear 4 s; capacity 4 active / 128 sessions | Bounded waits on Pi RPC | Per write | A wedged Pi child | Sized against Pi's observed abort behaviour (comment) | **Keep** |
| D16 | `conversation_linux.go: create` `histories` scan for ID collision; `list` tombstones | A freshly generated UUID colliding with an existing native session | Per create | Nothing: a v4 UUID collision | One directory walk per create | **Remove** the collision scan. |
| D17 | `decodeControl` strict JSON, `DisallowUnknownFields`, bounds | Request body shape | Per POST | Malformed input from our own browser | Small | **Keep** as the single validator (G15 removed). |

### Provisioning (`internal/provision`), judged lightly

| # | Where | What | Verdict |
|---|---|---|---|
| P1 | `writer_linux.go:309` recheck under lock after activation | Route only returned if policy and binding still match after the executor ran | **Keep**; root-side, once per first login, blast radius is an account. |
| P2 | `executor_linux.go:478` external policy recheck before each irreversible host operation; `:757` `gateProperties` fail closed on unknown unit properties; `:805` ownership recheck | Each host mutation re-reads policy | **Keep**; once per provisioning. |
| P3 | `broker_linux.go: Startup` verifies every binding, refuses to start on drift | Boot-time integrity | **Keep** |
| P4 | `transport_linux.go` 2 s exchange timeout on authorize | Gateway waits at most 2 s | **Keep**, and it stops mattering once G1 makes authorize a login-only call. |
| P5 | `state_linux.go: readState` full re-read and re-validation of allowlist and bindings on every authorize | Per authorize | Fine once per login (G1). As it stands it is the per-request cost behind G1. |

### Browser (`web/src/app`, state in `web/src/components`)

| # | Where | What it checks | When | What it protects, concretely | Cost | Verdict |
|---|---|---|---|---|---|---|
| B1 | `App.tsx` `verifying` mask (`ah-identity-check`, `visibility: hidden`, `inert`, `aria-hidden`) | Content hidden until `/auth/session` and `/api/v1/snapshot` both return | Every `refresh()`: window focus, visibility change, `turn.settled`, stream reconnects, `onResnapshot`, manual refresh | The one real case: another person signed in in this browser while the tab was hidden, and the old person's content must not stay on screen for them. Issue [keep-conversation-view-stable](../../issues/keep-conversation-view-stable/item.md) is the recorded reason. But the store already handles that case: the `authenticated` reducer resets state when `web_identity_id` changes, and `App.tsx:448` fails closed on a mismatched snapshot. The mask hides content from the *same* person for the whole round trip to prove nothing changed. | Lab: 16 requests per tab return, mask 31 ms on loopback; pilot: several seconds per return under load; the `aria-hidden` on a focused `<h1>` console error; `captureEditor`/`useLayoutEffect` focus restoration exists only to undo the mask's damage. Bug `session-mask-on-every-refresh`. | **Remove** the mask and the focus/blur/visibility listeners. Refresh in the background; swap state in place; reset state when the new snapshot's identity differs. |
| B2 | `App.tsx` 10 s timeout → `retain` → `stale` phase, `verifiedToken`, `timedOut`, `retaining` | Keep old facts on screen only if `/auth/session` still returns the same token | On refresh failure | A failed snapshot after a cookie change. Same case as B1; same answer. | ~60 lines, three flags, `stale` prop threaded into `BrowserConversation` and `HistoryView` where it disables controls and relabels everything | **Remove**. A failed background refresh shows the existing `ConnectionBanner` in its stale state and leaves the content as it is. Writes still go to the server, which answers 401 or 503 on its own. |
| B3 | `App.tsx` `sessionBinding`, `identityEpoch` (remount key), `loginGeneration` | CSRF token unchanged between checks; whole tree remounted on epoch bump | Per refresh | Identity change, again. `identityEpoch` remounts the entire tree to drop `BrowserConversation` state; `conversationPlace` and `sessionStorage` are cleared in four separate places. | Duplicates the store's `generation` | **Remove** `sessionBinding` and `identityEpoch`; keep one reset in the reducer; key the tree on `web_identity_id`. |
| B4 | `App.tsx` `sessionStorage` `nah:` purge on identity change, logout, every `fail`, and inside `load` | Drafts and markers of the previous person are not shown to the next | On those events | Real for identity change and logout. The keys include the CSRF token, so a re-login of the same person also discards their drafts. | Four copies | **Simplify**: one purge in the reducer path on identity change and on logout; key storage by `web_identity_id` only (B10). |
| B5 | `App.tsx` `piChecked` first-load Pi status | One `/onboarding/pi/status` per page load | Once | Onboarding decision; pilot.15 | One Node process per page load | **Keep** |
| B6 | `BrowserConversation.tsx` `sessionCSRF` before every `refresh()` (`refresh:343`) and `verify()` before every write | Token still equals the one captured at mount | 12 per idle minute (lab); before every send, queue, abort, continue, create | A session that changed since mount. The server already answers 401 to a stale cookie and the write carries the CSRF header; a pre-check proves nothing the write itself does not. | Half of the idle request volume; "Varmistetaan istuntoa." shown before every send | **Remove**; handle 401 from the real request. |
| B7 | `BrowserConversation.tsx` mount effect: `sessionCSRF` + `list` before anything renders; `sessions`, `recheckList`, "Tarkista keskustelulista" | Conversation is in this browser session's lease | On mount | G14. Falls with it. | Two requests before the first meaningful render (bug `conversation-open-flicker`, first of three phases) | **Remove** with G14. |
| B8 | `BrowserConversation.tsx` `streamError`, `probePending`, events probe fetch, "Live-yhteys katkesi", `canSend` gated on `!streamError` | Writes blocked while the status stream is not open | On any stream error, including the designed 20 s close when `opened` was not observed | Nothing: whether a write is admissible is decided by the daemon (409 `control_uncertain`). A read stream's health has no bearing on it. This produced the pilot.14 read-only state. | ~80 lines, exponential retry, probe fetch | **Remove**. Stream loss shows a banner and nothing else. |
| B9 | `BrowserConversation.tsx` `ambiguous` (sessionStorage `nah:ambiguous`) read at render; notice "Aiemman pyynnön tulos epävarma" when `ambiguous && sendObservation.state !== "uncertain"` | A write whose response was lost | Rendered on every render while the key exists | Real for a lost response. But `submit()` sets the key *before* the request and clears it only when the next `refresh()` sees acceptance, so every normal send shows the "previous request uncertain" notice for the whole pending window. Bug `uncertain-flash-on-send`. | One notice, wrong timing | **Simplify**: pending is pending (`SendObservation` already renders it); "uncertain" only after the request fails or times out, and then it stays. |
| B10 | `BrowserConversation.tsx` storage keys `nah:<kind>:<identity>:<csrf>:<id>` for draft, submitted, last-send, abort, continue, continued, ambiguous | Markers scoped to one login | Per render (`sessionStorage.getItem` inside render and inside `refresh`) | Scoping to the person is real; scoping to the CSRF token is not (B4). Seven keys read in render and reconciled in a 150-line block of `refresh`. | The reconciliation block (`refresh:361-483`) is the hardest code in the file | **Simplify**: key by identity and conversation; keep draft, last-send and continue markers; drop `continued`, `abort done:` and the derived receipt strings. |
| B11 | `BrowserConversation.tsx` `refresh` history walk: re-read page 1 and walk forward up to 16 pages on every refresh | Timeline prefix unchanged | Every refresh | Native history changed under the browser; real after `snapshot.invalidated` | Lab: 19 history reads for one send | **Simplify**: read history on open and on `history.entry`/`snapshot.invalidated`; otherwise append from the event. |
| B12 | `BrowserConversation.tsx` 3 s poll timer (15 s while SSE open) plus 3 s stream reconnect plus events reconnect with backoff | Fallback when streams fail | Continuous | Belt and braces for D5/D8 | 12 status/min idle | **Remove** the status stream and the fast poll with D5; keep one slow fallback poll (60 s) while the events stream is down. |
| B13 | `BrowserConversation.tsx` three-source open: empty timeline → history → status/live tail; `App.tsx` keys the component on `location.search`, so navigating into a conversation remounts | Nothing; it is sequencing | On open | Bug `conversation-open-flicker` | Three renders, 0.5 s each on the server | **Simplify**: one loader fetching status and history in parallel; render a single loading state until both are in; mount once per conversation id. |
| B14 | `BrowserConversation.tsx` `continuation` states, `retryContinuation`, `continueAttempt`, `recheckContinuation` | Continue only after an explicit re-check | On ended conversations | The server already returns 409 `writer_conflict` etc.; the browser can show the refusal | ~90 lines | **Simplify**: press continue, show the server's answer. |
| B15 | `PiOnboarding.tsx` 900 ms attempt poll with `sessionCSRF` before each, single-flight guards, focus re-check | Device-code progress | During onboarding only | Onboarding feedback | 2 requests/s for up to 5 min | **Simplify** to a 2 s poll without the session pre-read. Low priority. |
| B16 | `conversations.ts`, `snapshot.ts`, `pi.ts` strict parsers, bounded readers | Response shape | Per response | Programming errors on either side surface as errors, not as undefined UI | Lines, but one copy each | **Keep**; this is the browser's one validation layer, which is why G8 to G10 are redundant. |
| B17 | `store.ts` reducer: identity change resets filter and bumps `generation` | Previous person's state | On snapshot with new identity | The real case | Tiny | **Keep**; make it the only place. |

## Part 2: the structure behind the pattern

### Who owns "is this view current" and "is this user still this user"

The browser currently owns both, and that is the root of the pattern. The
server knows when a session ended (it deleted it), when the broker rebound a
subject (it ran the broker), and when native state changed (the daemon's
journal publishes it). The browser cannot know any of these; it can only ask.
So every event that might have happened while the browser was not looking
became a trigger to ask again, and every ask became a mask, because an answer
in flight was treated as "unknown" rather than "unchanged until told otherwise".

"Is this user still this user" has exactly one server-side answer: the session
cookie maps to one subject, and the server refuses a request when it does not.
A browser cannot change its subject without going through `/auth/github/start`,
which replaces the cookie. The only way a tab shows the wrong person's content
is that someone else logged in from another tab in the same browser. The
server handles that by answering the next request with the new identity's
snapshot, and the reducer already resets on an identity change. Nothing the
browser does on focus adds to that. The mask protects against a case the data
path already handles, at the price of hiding the same person's content from
themselves several times a minute.

"Is this view current" belongs to the daemon's journal. The journal publishes
`snapshot.invalidated`, `history.entry`, `turn.settled`, `command.changed`,
`question.requested` and `queue.changed` with a cursor; the browser detects a
gap and resnapshots. That is the whole mechanism in `docs/interfaces.md`, and it
is implemented. Everything else that polls or ticks (status stream every 2 s,
status HTTP every 3 s, history walk per refresh, session read per refresh,
focus refresh) exists because the browser did not trust the journal to tell it.

### Two sources of truth for the same fact

- **Conversation state** exists in the daemon's `conversation` struct, in the
  2 s status stream frame, in the status HTTP reply, in the journal's
  `command.changed`/`turn.settled` events, and in the browser's `current`,
  `receipt`, `sendObservation`, `ambiguous` and `continuation`. Five copies.
  The 150-line reconciliation block in `refresh` exists to reconcile them.
- **Whether a write is allowed** is decided by the daemon (`sendKind` 409), by
  the gateway lease table (G14), and by the browser (`canSend`: `!streamError`,
  `!stale`, `!busy`, `!ambiguous`, `!continuation`, state in a set). Three
  places. Only the daemon's answer is true.
- **Identity** is in the gateway session, in the broker reply (checked per
  request, G1), in the daemon's root-owned binding (re-read per request, D8),
  in the `X-Agent-Host-Identity` header (D9), in the snapshot body (G9), and in
  the browser's `sessionBinding`/`identity`/`priorIdentity`/`lastIdentity`.
  Each hop re-derives what the previous hop already decided.
- **Native history** is Pi's JSONL file. It is read in full by `observe` every
  2 s (D5, D6), twice more by `continuationProof` (D7), by the history route,
  and by the browser's walk (B11). The journal's `history.entry` events were
  built so this would not be necessary.
- **Conversation ownership** is the daemon's flock (D12) and the gateway's
  cookie-keyed table (G14). The flock survives restarts; the table does not,
  and the browser has to ask the table (B7) before it trusts the daemon.
- **Pi runtime trust** is the root-owned tree verified by the operator at
  install, and re-verified by the daemon on every native call (D1, D2).

Every pair above is a place where "recheck" was the answer to drift between
two copies. Removing the second copy removes the recheck.

### The target shape

**Gateway.** Authenticates the browser once per login: OAuth, broker `ensure`
and `authorize`, token handoff, session issued (G3, unchanged). After that a
request is: cookie → session map → identity → mapped socket, with Origin and
CSRF on writes. The session ends on idle or absolute expiry, logout, or
`RevokeSubject`. The gateway never asks the broker again for a live session.
Every `/api/v1/*` route is the same forty lines: check session, check the
socket is the mapped one (G7, once), open an `http.Transport` with a Unix
`DialContext`, copy method, path, query, body and `Last-Event-ID` in, copy
status, `Content-Type` and body out with one size cap, follow the browser's
context plus a long safety deadline. Streams are copied with a flush per write
and a write deadline. No response is parsed. `auth.go` keeps OAuth and
sessions; the five proxy files become one. The lease table goes.

**Daemon.** Validates once at start: binding file, UID and home, Pi selector,
Pi runtime tree, Node version (D1, D2, D8). Refuses to start otherwise. Per
request it checks the peer UID from the connection and nothing else. It owns
every conversation of its UID; whoever reaches its socket is that user. Status
is computed on request from in-memory state and a `stat` of the native file.
Continuation proof runs when the user asks to continue, and once when an ended
conversation is opened. The journal is the only push channel: long-lived,
heartbeat every 20 s, and it already carries every state change. The per-
conversation status stream is deleted.

**Browser.** Loads once: session, Pi status (once per page), snapshot. Opens
the events stream from the snapshot cursor and keeps it open. On an event it
updates in place; on a gap, `snapshot.invalidated` or a 409 it fetches a new
snapshot and the affected history, without a mask. On open of a conversation
it fetches status and history in parallel and renders once. A write sends the
request; the result is pending until the server answers, then accepted,
rejected, or uncertain only if the request itself failed after being sent. The
server's 401 is the only trigger for the login view; a changed
`web_identity_id` in any snapshot is the only trigger for a state reset. A
transport failure shows the stale banner over unchanged content and retries on
`online` and on an explicit button. There is no focus listener. The user sees
a mask never, a loading state only on first load and conversation open, and an
error only when the server answered with one.

### File sizes and seams

- `web/src/app/BrowserConversation.tsx` (1751 lines) is three things: a
  loader and state machine for one conversation (status, entries, live turn,
  events), a composer with write actions (send, queue, clear, abort, continue,
  create), and a reading-position keeper (anchor capture/restore, scroll,
  unseen count, place map). With B6 to B14 gone the first two halve. Split
  along those three seams: `useConversation(id)` returning status, entries and
  live turn; `ConversationActions` owning the writes and their notices; the
  anchor code into `useReadingPosition`. The place map and focus restoration
  only exist because the mask remounted the tree; they go with B1.
- `internal/daemon/conversation_linux.go` (1454 lines): `drain` and
  `publishDelta` (Pi RPC event → journal and state, ~250 lines) are a separate
  concern from HTTP handling and belong in `pi_events_linux.go`;
  `continuationProof`, `continueEnded`, `existingHistoryKeys` and
  `publishNativeHistory` (~250 lines) belong in `continuation_linux.go`;
  `stream` (90 lines) is deleted. The remaining HTTP handlers are ~600 lines.
- `web/src/app/App.tsx` (1037 lines): the session/snapshot loader with its
  mask is ~250 lines and becomes ~80; the rail (`WorkspaceRail` props and the
  `agents` mapping, ~120 lines) moves into a `WorkspaceRailView` component; the
  main-area switch stays.
- `internal/gateway/auth.go` (686 lines): once G1 and G16 are gone, split OAuth
  (start, callback, provider shapes) from sessions (`authenticated`,
  `authorizeWrite`, `current`, `logout`, revoke). The proxy files collapse into
  one `proxy_linux.go` of roughly 150 lines replacing ~1600.

## Part 3: ordered removal plan

Each step leaves the product working and the gate green. Tests named are the
existing ones that must still pass or be rewritten to assert the new behaviour;
`TESTING.md` lists how they run.

1. **Gateway: authorize once per session.** Remove the broker call from
   `authenticated`; remove the second `authenticated` in the conversation
   handler and the per-frame/heartbeat rechecks in both forwarders. Keep
   expiry, logout and `RevokeSubject`.
   Proves it: `auth_test.go` session tests, `revoke_test.go` (revocation still
   removes sessions), `TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers`
   (two users still cannot cross).
   Simpler downstream: `BrokerFailure` plumbing and `ErrBrokerUnavailable`
   shrink to the login path; broker lock contention disappears.
   Risk if wrong: an operator who edits the allowlist and expects instant
   logout. Mitigation is already in ADR 0006: run `RevokeSubject`. Document it
   in `docs/adr-0006` as the only runtime revocation path.

2. **Gateway: one proxy function.** Replace G7 to G13, G15 and G17 with one
   stdlib proxy over a Unix transport, one body cap, one long deadline. Delete
   the error-code and event allowlists and the 502/503 distinction.
   Proves it: `snapshot_integration_linux_test.go`, the conversation and
   events gateway tests reduced to "status and body are forwarded, streams
   flush, oversize is cut"; browser Playwright specs unchanged.
   Simpler downstream: adding a status field or event kind touches daemon and
   browser only; `pi.ts` loses the 502 branch.
   Risk if wrong: a daemon bug that emits garbage reaches the browser's
   parsers, which reject it with the same user-visible result as today.

3. **Daemon: validate once at start.** Move D1 to D3 and D8 into startup;
   per request keep the peer UID; drop the identity headers (D9) on both
   sides; drop D16.
   Proves it: `pi_runtime_linux_test.go` and `pi_device_linux_test.go`
   re-targeted at startup; `TestFixtureSnapshotAndEventsDoNotProbePi` extended
   to count no `node` spawn and no selector read during create and status
   (the fakes already count).
   Simpler downstream: `PiDevice.validate` becomes a constructor;
   `historyAuthorized` becomes `trusted(r)`.
   Risk if wrong: an operator who replaces the Pi tree under a running daemon.
   `docs/pi-runtime.md` already requires a restart; `fleetrepo` does one.

4. **Daemon: delete the status stream; status on demand; proof on demand.**
   Remove `stream`, D5; `observe` uses `stat` for revision (D6) and computes
   `continuation` only when the request asks for it (query flag or a separate
   route) and in `continue` (D7). Events stream lifetime 10 min, heartbeat
   20 s, validity checked at open.
   Proves it: `TestConversationStreamDoesNotProbeOrRevoke` and
   `TestConversationStreamCursorAndNativeRecovery` are deleted;
   `TestEventStreamExactReplayAndLastEventID` and
   `TestEventJournalNativeBurstHasTrailingInvalidation` unchanged;
   `conversation_linux_test.go` send/abort/queue/question tests unchanged; a
   new test asserts status for an ended conversation does one proof per
   explicit request.
   Simpler downstream: `httptest.NewRecorder` in production code goes;
   `streamSeq` and `conversationStreamFrameLimit` go; the browser loses one
   EventSource and the 3 s poll.
   Risk if wrong: a state change the journal does not publish. Audit:
   `state` transitions pending→accepted/rejected/uncertain are published as
   `command.changed`; settlement as `turn.settled`; questions, queues and
   invalidations have their events; `auth_error` is set on a `message_end` frame, which already triggers
   `invalidateNative`, so the browser re-reads status.

5. **Gateway: delete the lease table** (G14) and the browser `list`
   dependency (B7). Jari's decision to record in the issue: any session of the
   same person controls their conversations.
   Proves it: `conversation_auth_linux_test.go` (daemon one-writer rule still
   holds), a gateway test that two different users still get 404 for each
   other's IDs (the daemon answers that, since the ID is not in its map).
   Simpler downstream: `recheckList`, "Tarkista keskustelulista",
   `browserSessions` in `App.tsx` and the list filtering go.
   Risk if wrong: a second browser of the same person sends to a conversation
   the first is watching. The daemon serializes writes and both tabs see the
   same journal; this is the SSH-and-browser case the architecture already
   accepts.

6. **Browser state model, one step.** Remove the mask, focus/blur/visibility
   listeners, `retain`/`stale`, `sessionBinding`, `identityEpoch`,
   `loginGeneration`, `captureEditor`, `conversationPlace`, and the four
   `sessionStorage` purges, leaving the reducer reset on identity change and
   one purge on logout (B1 to B4). In `BrowserConversation`: drop
   `sessionCSRF`/`verify` pre-checks (B6), `streamError`/probe (B8), the
   status stream and fast poll (B12), the session/list mount step (B7); one
   loader for status + history on open (B13); pending rendered as pending and
   "uncertain" only after a sent request fails (B9); storage keys by identity
   and conversation (B10); history read on open and on `history.entry` or
   invalidation (B11); continue shows the server's answer (B14). Keep the
   first-load Pi check (B5) and the strict parsers (B16).
   Proves it: rewrite `web/tests/browser-conversation.spec.ts` to assert no
   `.ah-identity-check` ever renders, one render on open, no notice during a
   normal send, 401 leads to the login card, a snapshot with a different
   identity resets the view; keep the `first-use-ux` and `github-*` specs;
   `conversationEvents.test.tsx` unchanged. Lab measurement afterwards should
   show an idle tab at 1 open events stream and 3 heartbeats per minute.
   Closes: `session-mask-on-every-refresh` (B1, B2), `conversation-open-flicker`
   (B7, B13), `uncertain-flash-on-send` (B9).
   Risk if wrong: another person's content visible after a hidden-tab login
   swap. The server answers the next request with the new identity and the
   reducer resets; the Playwright "new subject mid-check" case from
   keep-conversation-view-stable is kept as the regression test.

7. **Splits.** Apply the seams in Part 2 to `BrowserConversation.tsx`,
   `conversation_linux.go`, `App.tsx` and `auth.go`. Pure moves; the gate
   proves them.

8. **PiOnboarding cadence** (B15): 2 s poll, no session pre-read. Proves it:
   `PiDeviceSignIn.test.tsx`, `first-use-ux.spec.ts`.

After step 6 the remaining caution is: login (G3, G4, G6, G18 to G20),
provisioning (P1 to P5), daemon startup validation, one-writer and no-duplicate-
write rules (D11 to D15, D17), and the browser's parsers. Each of those has a
scenario written next to it above.
