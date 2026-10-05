# Logging policy: implementation plan

Jari approved the [proposal](proposal.md) on 2026-10-04 and asked for this plan
before any code. It says what the implementation consists of, which parts wait
for a decision with him, and what the implementer needs to know that the code
and the earlier documents do not show. The [source inventory](preparation.md)
describes the starting point; the [existing evidence](result.md) covers only
selected exclusions and an immediately failing writer, so it does not prove
anything new here.

## What stays fixed

Diagnostics are bounded JSONL on service stderr, separate from the broker's
provisioning journal and the daemon's conversation event journal, which are
application state. Logs inform an operator; they never decide anything. The
gateway authenticates browser actors, the broker authorizes admission and
binding, and the daemon trusts only its own binding ([identity and
trust](../../docs/architecture/identity-and-trust.md), [ADR
0003](../../docs/decisions/adr-0003-host-stack.md), [ADR
0004](../../docs/decisions/adr-0004-first-login-user-provisioning.md)). A
correlation or support reference that arrives in a request is diagnostic data
and nothing more: peer credentials, the mapped-socket checks, the allowlist and
the verified session keep deciding authority and routing, and no identity or
routing decision may depend on a reference. If a slice would make that
tempting, it is the wrong design for the slice.

## Decisions to settle with Jari first

Two of the slices below change how components talk to each other or who can
read what. Those are architecture, so they get a decision and an ADR before
code. The rest can proceed in product scope as soon as the round is authorized.

**Correlation across authorities.** The proposal recommends carrying the
gateway's login attempt ID to the broker and the mapped daemon. Today the ID
stays inside the gateway; the broker protocol rejects unknown fields by design
(`internal/provision/protocol.go`), and the daemon credential handoff is its own
frame in `internal/transport`. Both interfaces and their tests change
deliberately, with receivers validating length and charset. Ordinary browser
requests need a distinct, server-generated support reference, and the question
is whether and how it crosses the gateway's rebuilt proxy request into the
daemon. Recommendation: two separate opaque references, joined only in gateway
records when relevant, and browser-supplied correlation headers ignored, because
a value the browser chose can be made to collide with or impersonate another
user's trace.

**Who reads which records.** The proposal recommends root-authorized access to
broker records, a restricted operator group for gateway records, and the owning
user plus authorized operators for a user's daemon records. Fleetrepo's
`nah-admin` login (`infra/native-agent-host-test/ADMIN.md`) is described as able
to read logs; a general journal group would also expose broker records and other
users' daemon records to it, which breaks the Unix-user boundary the product is
built on. The open question is how wide that operator's view should be, and what
to do if journald cannot express the chosen separation. Recommendation: bring
the limitation and options to Jari rather than adding a second log copy or a
log service, since each extra store is another place for user data to leak.

**Operator attribution.** Revocation ([ADR
0006](../../docs/decisions/adr-0006-subject-revocation.md)) records the target
subject. The root-only control socket proves a privileged peer, not which human
acted, and [ADR 0011](../../docs/decisions/adr-0011-gateway-owned-server-administration.md)'s
CLI path has the same shape. Browser-managed privileged changes can name the
verified session actor. The question is whether "root peer" is an acceptable
actor for CLI administration or whether a verified operator identity is wanted,
in which case that boundary is designed before attribution is claimed. Until
then records say honestly that the actor is a root peer; a name inferred from
the subject, the request body or UID 0 would be a guess dressed as evidence.

**Retention.** Seven days ordinary and thirty days for broker and privileged
records are sizing suggestions. The real policy is chosen after Fleetrepo has
measured volume and checked what journald can enforce; a per-class retention
that the journal cannot implement should not be promised in documentation.

## Product slices

**Bounded emitter.** One small reusable JSONL envelope for all three components:
component, event, outcome, operation reference where there is one, and a closed
reason vocabulary. `CallbackLogger` in `internal/gateway/auth.go` is the
starting point; the field inventory also has to cover the CLI startup and
listening lines in `internal/cli` and the guard records in
`internal/provision/broker_linux.go`, which have different fields today.
Gateway `slog` writes synchronously, so a blocked stderr can currently hold a
login; the emitter needs a bounded nonblocking handoff, caps on bytes per
record and on total buffered records, and a rate or aggregation budget for
repeated events. The existing unmatched-callback limiter (32 burst, one per
second) bounds one event, not the stream. Count what is dropped and emit a
summary when delivery resumes, and let shutdown give up on a stalled sink
rather than wait. One honesty point: a sink that stays blocked forever can
never report its own loss, so do not write a test or a document that claims it
can.

**Gateway outcomes and support reference.** Extend the OAuth and classified
broker-failure records to pre-flow start failures, routing and proxy failures
and Access denials. Replace the constant `req_00000000` in the gateway's safe
error response (`internal/gateway/auth.go`; the daemon has its own copy in
`internal/daemon/snapshot_linux.go`) with a server-generated opaque reference
and write a record carrying the same reference. Not every HTTP error will have
a match: some routes bypass the safe helper, proxied daemon responses pass
through, and a dropped record is a dropped record, so documentation should say
"usually", not "always". OAuth failures end in an HTML redirect, and a
reference in a URL ends up in ingress logs, so the login UI needs another way
to show it. Change the browser contract and UI only if the agreed support
interaction needs it.

**Broker coverage.** Record admission denial, authorization failure,
reservation, publication, readiness and the final result at the layer that
actually knows each outcome (`protocol.go`, `transport_linux.go`,
`writer_linux.go`, `broker_linux.go`), keeping the fixed guard-stage
classification. Publication, daemon readiness and later browser-session
issuance are different outcomes and stay distinguishable. Log the broker's
validated subject when it helps; an unvalidated wire claim is not an actor.
Candidate names, root paths, command output and credentials stay out by
default. The ledger and the native account remain the authority, so a logging
failure changes neither state nor reply.

**Daemon diagnostics.** Per-operation records at the credential handoff
(`internal/transport`, `internal/nativegh`), Pi device start and snapshot and
native discovery (`internal/daemon`). The user identifier comes from the
daemon's trusted binding, never from a request field. Keep handoff
acknowledgement, native credential readiness and snapshot failure apart.
Tokens, device codes, Pi session content, tool output and native command
stderr are the content the policy excludes.

**Documentation.** When the code is in, update [deployment](../../docs/architecture/deployment.md)
and [identity and trust](../../docs/architecture/identity-and-trust.md) to
describe what actually ships: the record flow, the reader boundary and what
happens on loss. A changed protocol or reader model gets a new ADR rather than
an edit to an accepted one.

## Fleetrepo slice

Fleetrepo owns journal and service permissions, reader groups, expiry and disk
caps, ingress and tunnel logging and the operator's path to the test server.
Inspect the effective state before changing it, including whether `nah-admin`
can read every unit and whether ingress captures callback URLs. Then configure
the agreed reader model and verify it on the disposable test guest with root,
the restricted operator and two distinct mapped users trying to read each
other's records, a synthetic failed OAuth callback with correlated broker and
daemon failures, and controlled volume against the expiry and space limits.
Deployment configuration and receipts go to Fleetrepo under its own convergence
procedure; a neutral change to the service templates in this repository is
fine if portable behaviour needs it, host-specific groups and journal config
are not.

## What counts as evidence

Each changed Go package carries its own tests, and the final candidate runs
`./scripts/ci-local.sh --clean --json` per [TESTING.md](../../TESTING.md), with
the root, UID and socket VM scenarios from that guide where a broker or daemon
trust boundary moved. The point that is easy to miss: test a writer that
blocks, not only one that returns an error at once, and assert bounded memory
and latency, unchanged authorization decisions and explicit loss accounting
under a sustained flood. Synthetic tests prove the product's behaviour; only
the Fleetrepo guest run proves deployed read permissions, retention and ingress
capture, and the result should say which is which, including any skipped
prerequisite.
