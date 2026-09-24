---
created: 2026-09-24
updated: 2026-09-24
type: feature
status: done
priority: high
lane: auth-jit
lane_seq: 30
collision: [internal/provision/]
blocked_by: ['@implement-jit-broker-core']
closed: 2026-09-24
closed_by: agent
---

# Implement fail-closed local broker socket transport

## Goal
Add a strict local **Unix-domain broker transport** for ADR 0004's broker. Reuse landed `internal/provision/` policy/wire contract without enabling account creation, gateway use or public ingress. This is a transport walking slice only: no privileged account mutation or OAuth/token in broker.

## Acceptance Criteria
- [x] Provide reusable Linux server/client transport for a **pre-opened systemd Unix socket** (no self-created world-traversable path), with exact single FD validation, bounded one-request/one-reply framing and deadlines, no untrusted paths/UID/candidate to shell, kernel SO_PEERCRED gate allowing only configured gateway UID, and closed failures on malformed messages, extra bytes, unknown version, disconnect and wrong UID. Never accept a header/user-supplied claimed UID as peer proof. No TCP listener.
- [x] The service must not return routable targets just because `Store.Evaluate` found a ledger entry; until NSS/home/socket/unit drift checks and writer lock exist, default handler DENIES/returns unavailable. Handler injection in hermetic tests may exercise protocol/peer only. No `useradd`, groupadd, runtime activation, OAuth code/token or gateway callback change in this slice.
- [x] Tests cover permitted/denied peer, malformed and oversize wire, truncation, cancellation/timeouts, root-state corruption, without using production credentials or host paths. Full Go format/vet/race and generated-drift checks pass. Issue result documents next privilege/writer seam and absence of live guest proof.
