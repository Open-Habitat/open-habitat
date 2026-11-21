---
created: 2026-11-21
updated: 2026-11-21
type: improvement
status: done
priority: normal
provenance: other
provenance_detail: Technical decision requested by the maintainer
source_ref: taskfleet:01m7z2ac7zah3xt86cnr1ydmt9/implementation:single-microsoft-process
originating_run: 01m7z2ac7zah3xt86cnr1ydmt9
originating_run_kind: technical-decision
lane: microsoft
lane_seq: 1
preparation: ready
closed: 2026-11-21
closed_by: agent
---

# Share one Microsoft MCP process across a person's conversations

## Problem

Microsoft MCP processes currently multiply with open conversations. Five topic entries must not multiply them again. Jari requires one Microsoft process per person, including when multiple conversations or accounts are open. Category-prefixed file searches still return mailbox deletion, so the tool areas remain useful.

## Proposed implementation

Implement ADR 0039 after architecture acceptance. Its access boundary is the own Unix user explicitly required by Jari; no broader principal is proposed. The person's existing daemon owns one native stdio Microsoft child; five short, described area entries per account use lightweight stdio-to-Unix relays in the product binary. Do not deploy the experiment's Python/Node proxy as production machinery. No gateway or broker Microsoft authority, no TCP backend, and no second credential store.

Retain native per-account cache, application, expected-identity and permission bindings. One upstream slot may serve concurrent calls for one binding. Different bindings require draining, stopping and reaping the child before starting the replacement; never a pool or simultaneous second Microsoft child. Bound queues, support cancellation, and do not replay uncertain writes. This multi-account scheduling design is not yet tested by the single-account research.

## Acceptance Criteria

- [ ] Jari accepts the proposed architecture in ADR 0039 before implementation begins; any broader access than the already required own-UID boundary returns for a new security decision.
- [ ] At most one Microsoft process per person under concurrent starts, multiple accounts, reconnects and conversation closures; zero is allowed while idle/stopped.
- [ ] Other kernel UIDs cannot reach the MCP endpoint; exact peer UID checks and private runtime paths are tested through the production transport, including spoofed account claims.
- [ ] Each area's search/namespace listing and execution contain only that area's tools at the account's current permission level; sign-in tools remain unavailable.
- [ ] Native credentials and expected identity remain account-bound; account/configuration switches cannot reuse stale scope or results. Drain/reap/restart and interrupted writes have focused tests.
- [ ] Request IDs, cancellation, progress, disconnects and upstream failure stay with their originating client. No automatic write retry.
- [ ] Existing destructive-call confirmation remains in Pi's call pipeline.
- [ ] Measure the actual daemon/relay footprint with four conversations; report the whole MCP-side cost separately from Pi, not just the native child.

## Evidence and limits

See issues/agent-account-instructions-clarity/result-single-server.md, single-server-evidence.md and docs/decisions/adr-0039-one-microsoft-process-per-person.md. The networkless lab demonstrated a single native child behind four Pi processes, filtered discovery, concurrent listing/ping, conversation-close survival and filesystem denial to another UID. It blocked every upstream tool call. It does not establish production write routing, account switching, cancellation, signed-in behavior or installed-host isolation.

Born unlaned for the later human scheduling decision; this is implementation work, unlike the original issue's proposal deliverable.

## Resolution

### 2026-11-21T14:45:39Z · @agent

Implemented: one daemon-owned Microsoft process per person, five area entries with relays, migration, permission hook; see result.md.
