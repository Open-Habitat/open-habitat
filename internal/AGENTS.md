# Go runtime boundaries

Each package has one authority. Keep it that way: a change that makes one
component act on behalf of another is a design change and needs an issue.

- `gateway/` owns same-origin HTTP, OAuth/session/CSRF, static assets and
  routing to the mapped daemon. It never inspects user homes.
- `daemon/` runs as one mapped Unix UID and owns native discovery and child
  processes. It never authenticates browser identities.
- `provision/` is the root broker and Linux executor that create a person's
  Unix account on first approved login (ADR 0004), with its wire protocol and
  crash-safe journal.
- `nativegh/` and `transport/` hand the person's GitHub credential to their own
  native `gh`, running as their UID.
- `udssecure/` validates socket path ownership and root-controlled directory
  traversal at the client boundary. `SO_PEERCRED` on a socket bound by systemd
  identifies root, not the daemon UID, so the daemon separately checks that the
  connecting peer is the gateway UID.
- `core/` is authority-neutral domain code.
- `contracts/` is generated from `contracts/v1/`; never edit it by hand.
- `cli/` is the non-interactive operator surface and follows the AI-first CLI
  canon.

After changes run `go generate ./internal/contracts`,
`./scripts/check-generated.sh`, `go vet ./...` and `go test -race ./...`.
