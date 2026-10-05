# Logging policy: superseded implementation plan

> Historical, withdrawn plan. The current decision is [ADR 0013](../../docs/decisions/adr-0013-service-logging.md). Do not implement the new protocols, support references, async emitter or per-class retention from this plan; the current work is in @implement-diagnostic-emitter and @correlate-diagnostics.

This plan followed the [proposal](proposal.md) and a former correlation design that Jari subsequently withdrew. It records the thinking at the time, not what to build. The [inventory](preparation.md) describes the starting point; the [existing tests](result.md) cover only selected exclusions and a writer that fails immediately.

## The shape of it

Every service writes bounded JSONL to stderr. Logs are for operators to read;
they never decide anything. The gateway authenticates browsers, the broker
authorizes accounts, the daemon trusts its own binding, and a correlation
reference that arrives in a request changes none of that.

Work goes in this order because each slice builds on the previous one.

## 1. A shared emitter

Build one small envelope for all three services: component, event, outcome,
operation reference when there is one, and a closed set of reasons. Start from
`CallbackLogger` in `internal/gateway/auth.go`, and bring the CLI's startup
lines in `internal/cli` and the broker's guard records in
`internal/provision/broker_linux.go` onto the same envelope, since they use
different fields today.

Gateway `slog` writes synchronously, so a stuck stderr currently stalls a login.
The emitter hands records to a bounded queue and drops when it is full. Cap
bytes per record and records in flight, budget repeated events (the
unmatched-callback limiter of 32 burst and one per second only covers that one
event), count the drops and report them when writing resumes. Shutdown gives
up on a stuck sink after a short wait.

Tests: a writer that blocks, a writer that fails at once, a writer that
recovers, a flood, an oversized field. In each case the login or broker result
is unchanged, latency stays bounded, and the drop count is right. A sink that
never recovers cannot report its own loss; do not write a test that pretends
otherwise.

## 2. Gateway outcomes and the support reference

Add records for login failures before a flow exists, proxy and routing
failures, and Access denials. Replace `req_00000000` in the gateway's safe
error response with a reference generated per failure, and write a record with
the same reference. The daemon has its own copy of the constant in
`internal/daemon/snapshot_linux.go`.

Not every HTTP error will have a record: some routes bypass the safe helper,
daemon responses pass through the proxy, and a dropped record is gone. Say
"usually" in the documentation. OAuth failures end in an HTML redirect, and a
reference in that URL lands in ingress logs, so the login page needs another
way to show it, for example a cookie or a page rendered by the gateway.
Browser-sent correlation headers are ignored. Touch the contract and the UI
only if the chosen support interaction needs it.

## 3. Correlation across services

Carry the login attempt ID on the broker request and on the daemon handoff
frame. `internal/provision/protocol.go` rejects unknown fields on purpose, and
`internal/transport` has its own frame, so both interfaces and their tests
change deliberately. Receivers accept a short opaque token and refuse anything
else. Test two simultaneous logins and a three-service synthetic trace.

## 4. Broker coverage

Record admission denial, authorization failure, reservation, publication,
readiness and the final result in the layer that knows each one: `protocol.go`,
`transport_linux.go`, `writer_linux.go` and `broker_linux.go`. Publication,
daemon readiness and browser-session issuance are three different outcomes;
keep them apart so an operator can see where a login stopped. Log the subject
the broker validated, not the one on the wire. Candidate names, root paths,
command output and credentials stay out. Test concurrent ensures, a denied
request, an interrupted provisioning and a failing writer; state and reply
never change because of logging.

## 5. Daemon diagnostics

Add records at the credential handoff (`internal/transport`,
`internal/nativegh`), Pi device start, snapshots and native discovery
(`internal/daemon`). The user comes from the daemon's binding, never from a
request field. Keep handoff acknowledgement, native credential readiness and
snapshot failure apart. Tokens, device codes, Pi session content, tool output
and native command stderr are exactly what the policy excludes.

## 6. Attribution

Browser-managed privileged changes record the verified session actor, the
target user and the changed setting as separate fields. Revocation and other
root-only control actions record `root peer` as the actor, because that is all
the socket proves. Do not invent a name from the subject, the body or UID 0.

## 7. Documentation

Update [deployment](../../docs/architecture/deployment.md) and
[identity and trust](../../docs/architecture/identity-and-trust.md) to describe
what shipped: record flow, who reads what, what happens on loss. This section reflects the withdrawn design, not the current logging decision.

## Fleetrepo

Fleetrepo owns journal permissions, reader groups, expiry, disk caps and ingress
logging. Before changing anything, check what `nah-admin`
(`infra/native-agent-host-test/ADMIN.md`) can read today and whether ingress
captures callback URLs. The withdrawn design called for a special reader model and 7/30-day retention, then verification on the test guest: root, the operator and two mapped
users each try to read the others' records; a synthetic failed login produces
a trace across all three services; controlled volume hits the limits without
touching live users. If journald cannot keep the classes apart, say which
limit applies and bring it back rather than adding a log copy. Receipts go to
Fleetrepo.

## Evidence

Each changed package carries its tests, and the final candidate runs
`./scripts/ci-local.sh --clean --json` per [TESTING.md](../../TESTING.md), plus
the root, UID and socket VM scenarios where a trust boundary moved. Synthetic
tests prove the product; only the Fleetrepo guest run proves deployed
permissions, retention and ingress capture. The result says which is which and
names anything skipped.
