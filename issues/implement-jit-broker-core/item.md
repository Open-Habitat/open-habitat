---
created: 2026-09-24
updated: 2026-09-24
type: feature
status: done
priority: high
lane: auth-jit
lane_seq: 20
collision: [internal/provision/]
blocked_by: ['@decide-jit-github-user-provisioning']
closed: 2026-09-24
closed_by: agent
---

# Implement inert first-login broker contract and admission validation

## Goal
Implement the first *inert* application-side walking slice for accepted ADR 0004: a narrow, strict, testable broker protocol and root-owned authorization/binding state validators for first-login GitHub→Unix provisioning. This is **not** the runnable root service, gateway callback change or guest deployment. No gateway root access, no useradd from HTTP, no public listener and no credential material in the broker.

## Acceptance Criteria
- [x] New `internal/provision/` package (or better justified bounded owner) defines versioned typed `ensure` / `authorize` request and reply, canonical verified GitHub numeric ID, candidate handle only (not authority), exact failure codes, maximum message length, rejection of unknown fields, malformed/duplicate IDs, paths or credentials. No caller-supplied Unix UID is trusted. Read-only root-owned allowlist + binding-ledger validation and narrow config contract with strict ownership/mode/no-symlink checks; design code that future root-only service can own, without making a public/gateway endpoint live.
- [x] Hermetic tests prove denial of unknown/revoked/malformed ID, duplicate/colliding bindings, unsafe file ownership, replay/corruption handling and username collisions/renames according to ADR 0004. No assertion that fixture tests prove guest isolation. Preserve existing gateway startup/static mapping and CLI behavior until successor slice fully wires dynamic routing.
- [x] `go fmt ./...`, `go vet ./...`, `go test -race ./...`, generated drift check and `git diff --check` pass. Record scope/limitations and next implementation seam in issue-local result. Do not SSH or mutate Fleetrepo/guest/cloud; do not transfer OAuth tokens or create real Unix users.
