# Current logging and diagnostic gaps

Source inventory prepared on 3 October 2026, with the main findings checked
against revision `76fcc0c`. This describes application code and synthetic
tests; deployed journal access, retention and ingress settings were not
inspected. The [proposal](proposal.md) covers the recommended changes.

## Existing records

| Component | What it records | Main gap |
| --- | --- | --- |
| Gateway OAuth | JSONL on stderr with schema version, component, event, outcome and fixed failure reason. A random server-generated `attempt_id` joins OAuth start and a matched callback. Broker failures include operation and classified reason. | The attempt ID does not reach the broker or daemon. Failures before pending-flow insertion have no start event. |
| Gateway routing and control | Revocation records the target provider subject and number of removed sessions. A control-listener failure has a fixed event. | Proxy failures and Access assertion denials return HTTP errors without per-request diagnostics. Revocation does not record the operator who invoked it. |
| Root broker | JSONL on stderr for pre-reservation availability guards and exhausted binding names. Records contain a fixed guard stage. | Most admission, authorization, provisioning and readiness outcomes have no record. Guard records lack the gateway's component/schema fields and a common operation ID. |
| Per-user daemon | CLI startup errors and HTTP error responses. | The inspected credential-handoff, Pi device-start and snapshot paths have no structured per-operation diagnostic stream. |
| Browser | Application operation IDs support conversation and control requests. | These IDs are not linked to operator diagnostics. No production console diagnostic stream was found in the inventory. |

The source is in `internal/gateway` (authentication, proxy, access and
revocation), `internal/provision` (broker, writer, transport and protocol),
`internal/daemon` (handoff, Pi attempts and snapshots), and `internal/cli`
(service startup). Browser request handling is in `web/src/app`.

Gateway and daemon error responses still use the constant
`correlation_id: req_00000000`; it cannot identify a particular failure.
The broker request protocol has no correlation field. The daemon's conversation
event journal and the broker's ledger and pending files are application state,
not operator diagnostic logs.

Service stderr normally goes to the systemd journal. CLI errors and verbose
listening records have different fields from OAuth diagnostics, so the OAuth
field tests do not describe every line a service may emit. Actual journal
permissions, persistence, rotation and external ingress logs need separate
verification in Fleetrepo.

## What an operator can establish

**Malformed OAuth callback.** A matched callback with an extra query key logs
`shape_extra_key` with the start event's attempt ID, before provider exchange
or a broker call. An unmatched callback receives an independent ID when one
can be generated, subject to its rate limit. This distinguishes several gateway
failures, but gives no shared reference for other components or a user report.

**Provisioning failure.** A host availability guard can produce
`broker_guard / availability_error`, while the gateway records
`broker_operation: ensure` and a classified broker reason. These records can
be compared by time, but concurrent attempts cannot be reliably distinguished.
The guard does not identify the exact host check, and an allowlist denial
produces no guard event. The broker's private state is needed to establish
whether a binding or partial provisioning state exists.

**Native start or routing failure.** A Pi device-start failure returns
`native_source_unavailable`; failure to reach the mapped daemon returns
`daemon_unavailable`. Neither path produces a per-operation diagnostic record.
The response alone does not explain the native failure or distinguish routing
causes, and the constant correlation placeholder cannot connect it to a log.

**Privileged change.** No shared-setting mutation handler was present in the
inspected routes. The existing revocation record identifies the affected user,
but not the operator who acted. A target user is not necessarily the actor;
future privileged actions need attribution from the component that authorizes
them. User identifiers are allowed in logs under the issue's agreed policy.

## Delivery and coverage gaps

Gateway `slog` writes synchronously. A blocked stderr writer can therefore
stall a login, even though a writer returning an immediate error does not
change the tested login outcomes. Broker guard callbacks are synchronous too.
The agreed requirement that diagnostics not block the operation is still an
implementation gap.

Unmatched callback records have a token-bucket limit of 32 burst and one per
second. Matched start/callback events, repeated revocations and broker guards
have no equivalent overall budget. That one limiter proves neither a total
record cap nor a byte cap.

The [test results](result.md) cover selected secret/content exclusions and
prompt diagnostic write failures. They do not establish cross-component
correlation, complete actor attribution, blocked-writer behaviour or deployed
log access. Missing records cannot establish that an operation did not occur.
