# Host contract result

## Outcome

This delivery turns the accepted UI behavior, native Pi/workspace evidence and
ADR 0001 into a versioned browser↔gateway↔per-user-daemon↔native-adapter
contract. It does not implement a runtime and does not accept Proposed ADR 0002
or 0003.

The reader contract is [`docs/interfaces.md`](../../docs/interfaces.md). The
canonical JSON Schema 2020-12 artifacts, redacted exchanges and implementation
scenarios are under [`contracts/v1/`](../../contracts/v1/AGENTS.md). The offline
validator is [`validate_contracts.py`](validate_contracts.py).

## Exact inputs and revisions

Substantive work started after the separate in-progress metadata commit
`e85701356c96732e72f2f2051893b5ffb0606e95`. The inspected repository inputs
were:

| Input | revision containing inspected bytes |
|---|---|
| `issues/plan-v1-implementation/plan.md`, root `AGENTS.md` | `a41065f5984621e4c7c76050960b4e1ed3841086` |
| `AGENTS-WORKFLOW.md` | `891d4e50c096a1ab1e0d0d371f665f730b35fb31` |
| `docs/AGENTS.md`, prior `docs/interfaces.md` | `0b0a16419e280aff57f08ce6a747fcb03584488c` |
| accepted `issues/review-ui-v1/review.md`, `docs/product.md`, `docs/ui.md` | `9732ffbd3ff0af37911b84b86f321808e482c13b` |
| Pi probe result and redacted native events | `4187da0ec40079ec09d98539c03f840102cde616` |
| workspace probe result and both redacted JSON evidence files | `c1e06b0af9a2835106b5f27277dd1de31766856a` |
| accepted ADR 0001 | `642bd26c7f68009c8c59f284aca04f169ed97598` |
| Proposed ADR 0002 | `ffdf0e6eeb46aa44055b52569775d20956db1a01` |
| Proposed ADR 0003, architecture, assumptions, implementation | `958f974f1c9f1ac47af48b69a738bed7bfb1128b` |

The contract validator used the installed Python 3 environment and
`jsonschema 4.19.2`, but supplies its own deterministic RFC 3339/date-time and
UUID format checks rather than relying on optional format packages. It makes no
network call.

## Decisions encoded

### Identity, routing and trust

- The browser cannot select a Unix user, socket or UID. OIDC `(issuer, subject)`
  maps at the gateway to one configured daemon route. Origin and session-bound
  CSRF checks precede every write.
- The gateway strips browser routing hints. On the proposed local hop it adds an
  opaque internal web-identity header only after routing; the daemon trusts it
  only after the configured peer credential check.
- Snapshots and event cursors are daemon-authored. Gateway/auth/daemon outages
  are HTTP/connection states, not fabricated native snapshots or events.
- Content and free native diagnostics are untrusted and redacted. Credentials,
  absolute other-user paths and URL userinfo do not enter browser messages.

### Snapshot, stream and command semantics

- A snapshot is atomic at its cursor. SSE continues at the next sequence;
  `Last-Event-ID` wins on reconnect, old sequences deduplicate, and a forward
  gap or same-sequence conflict disables writes and requires resnapshot.
- The proposed replay bounds are 10,000 events or 15 minutes. A slow client is
  disconnected at 1,000 queued events, 1 MiB, or 30 seconds and then replays or
  resnapshots.
- Snapshot state includes target and user-scope observation tokens, active-turn
  state, pending question and bounded live tail, so first workspace creation and
  snapshot races are representable without invented client state.
- Command acceptance and execution remain separate. IDs are scoped to the
  authenticated web identity; parsed structural equality defines a retry.
  Proposed retention is 10,000 results or 24 hours in one daemon epoch. Missing
  after restart/eviction remains uncertain and is never auto-resent.
- Existing-resource commands use a target observation token. User-scoped create
  and clone use a snapshot token bound to identity plus the opened `~/src`
  descriptor. Unrelated assistant deltas do not stale steer/interrupt.

### Native capabilities and ownership

- History, process observation and control ownership are separate fields.
  Start, ended-session resume, message, steer, follow-up, whole-queue clear,
  turn interrupt and extension-question response reflect the Pi 0.85.1 evidence.
- A live terminal TUI is read-only. Transfer is a staged resume only after a
  known owner/user stop, confirmed exit, settled history and single-writer lock.
  A merely observed PID is never signalled.
- Taskfleet remains the sole supported owner of agent worktrees. Its create
  adapter remains `unknown/adapter_not_verified` until the actual supported
  source-branch/title/task flow and partial teardown are tested.
- The daemon owns one-off title generation outside the agent loop. Until that
  Pi adapter is verified the capability is `unknown`; pending/success/failure
  and regeneration never block or erase the prior title.

### Files, operations and annotations

- Mutations start from an opened `~/src` descriptor, reject symlinks/escapes/
  replacement/mount unknowns and never accept a browser OS path. Delete
  confirmation exactly equals the shown basename while the opaque observation
  token binds native identity.
- Workspace, Git/GitHub, Taskfleet, archive, transfer and delete results preserve
  confirmed/running/failed/unknown/skipped stages and residual effects. Retry
  uses a fresh snapshot and observation; no rollback is claimed.
- Workspace settings contain only schema version, stable ID and optional display
  name. Hiding first creates/uses a stable ID; basename-keyed hidden state was
  rejected to avoid inheritance after delete/recreate.
- User state is one sparse, atomic mode-0600 XDG file for hidden state, archive,
  replaceable successful title and a provenance-bearing parent only when native
  evidence cannot supply it. Missing/corrupt metadata loses presentation only;
  it never removes Pi history or Git/Taskfleet facts and is not silently
  overwritten.

## Machine-readable artifacts

- Common, snapshot, history/content, command/result, SSE event, error, staged
  operation and annotation schemas.
- An exchange-catalogue schema plus five redacted HTTP/SSE exchanges whose body
  files are independently schema-validated.
- Redacted snapshot, command, stream, error, partial-delete, annotation,
  long-history and title-failure fixtures.
- Twenty-nine deterministic CT scenarios. They cover two users and cross-user
  denial; OIDC-route/peer/CSRF/origin boundaries; snapshot races; Last-Event-ID,
  replay, gaps, expiry, backpressure and resnapshot; duplicate/uncertain
  commands; browser/daemon/session loss; TUI read-only/transfer; native queue,
  question and interrupt behavior; malformed content; long output; title
  failure/regeneration/unverified capability; path escape and confirmation;
  GitHub/Taskfleet/deletion partial results; archive; annotation corruption; and
  empty-account creation.

## Review

A critical evidence-gated review was selected because this contract controls
authentication, cross-user isolation, destructive operations, concurrency,
replay and untrusted rendering. `claude-fable-5-1` produced concrete candidates;
local checks corrected their actionable substance. A fresh `gpt-6-astra` pass
then found one remaining impossible state: a `scope:user` create required a token
that an empty snapshot did not expose. The snapshot user token, binding and
CT-029 fix it. The permitted narrow critical continuation returned `corrected`.
The persisted review and `/assess-findings` decision table are under ignored
`history/`; F1 is `CONFIRMED`, `REGULAR`, `FIX`, resolved in this delivery. No
review finding requires another issue.

## Validation

Run from repository root:

```sh
python3 issues/define-host-contracts/validate_contracts.py
# Host contracts valid: 10 schemas, 11 fixture files, 29 scenarios, 4 negative checks.

python3 scripts/validate-project-view.py
# Project View valid: 14 pages, 14 navigation entries.

issuectl doctor --json
# exit 0; recorded in the final command output

git diff --check
# exit 0; no output

issuectl dag --json --reservations '[]'
# exit 0; final reservation-aware state recorded below
```

The final DAG inspection must show no missing blockers/cycles, no deferred or
untriaged lane member and no lane on a human review. In particular,
`build-app-foundation` must remain blocked by open `review-implementation-plan`,
which remains blocked by its required preparation/design/contracts.

## Unresolved policy choices for `review-implementation-plan`

1. Accept or alter the proposed SSE retention/backpressure and command-ledger
   bounds. A longer daemon-restart idempotency guarantee would require justified
   durable operation metadata; this contract deliberately adds no command
   registry.
2. Verify and select the Pi one-off title-call mechanism, model, cost bound and
   automatic milestone trigger. Until then title generation is unavailable,
   not simulated in the browser.
3. Accept the Proposed ADR 0002/0003 versions and exact OIDC, session, CSRF,
   internal identity, socket and peer-credential implementation while preserving
   this observable contract.
4. Verify GitHub create/clone/push/delete for both pilot users and choose the
   credential integration without a gateway credential broker.
5. Prove the proposed 200-entry/65,536-byte history limits and 1,000-event
   live-tail bound against long Pi histories and pilot memory/backpressure.
6. Test workspace rename/cwd association, process-observation completeness,
   mount/symlink races, daemon-crash history settlement and Taskfleet partial
   create/teardown. Unknown remains fail-closed until proved.

## Implementation handoff

`plan-v1-implementation` should make `contracts/v1/` the shared contract-test
input. The host and web scaffolds should generate or hand-maintain types from
these schemas without changing their authority. Every `CT-xxx` must map to an
executable unit/integration/browser test, and native cases must compare the HTTP
result with Pi/filesystem/Git/Taskfleet state. The two-user, systemd/socket,
GitHub-write and title-call tests remain real implementation evidence, not mocks.
Any required semantic change returns to `review-implementation-plan`; do not
silently accept either Proposed ADR or narrow the accepted UI.

## Tool/sub-workflow inventory

All required commands and the critical review completed. One optional
`/assess-models` corpus append failed after the complete review because bounded
SSH to Alder returned permission denied (exit 3). The stable redacted record is
[`review-tool-failures.log`](review-tool-failures.log). This affects only the
external model-performance corpus; it does not affect the review, assessment,
contract or validation. Safe follow-up is to retry the helper when the existing
Alder SSH route is available, without changing repository or machine credentials.
No deployment or machine mutation was performed.
