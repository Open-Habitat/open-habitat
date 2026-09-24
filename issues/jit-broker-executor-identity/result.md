# Broker executor identity result

`Writer.Handle` now supplies an immutable `ExecutorIdentity` value to every `Step` and `Verify`: fixed `github` provider, canonical allowlist ID for a new binding (committed ledger ID for an existing binding), server-assigned Unix name and UID. The pending journal and published binding use that same snapshot. A renamed login cannot change the committed identity; revocation denies before executor verification. `Available` retains name/UID collision checks. The value does not attest the remote user independently of the gateway's validated broker request.

The fake executor records every attempted phase and verification, including failures. Hermetic tests assert exact provider/ID/name/UID for new, existing, renamed, revoked, alternate-name and concurrent different-ID paths, and no executor calls on corrupt state. This does not implement a real Linux executor or establish daemon/host isolation. No guest, Fleetrepo, cloud, service or gateway changes were made.

## Verification

Tested this worktree's change against base `2ecb887` on 2026-09-24:

- `go fmt ./...` — passed
- `go vet ./...` — passed
- `go test -race ./...` — passed
- `go generate ./internal/contracts` and `./scripts/check-generated.sh` — passed, no generated drift
- `issuectl doctor --json` — passed, no warnings
- `git diff --check` — passed
