# Go runtime boundaries

- `gateway/` owns same-origin HTTP, future OAuth/session/CSRF handling, static
  assets and routing to a mapped daemon. It must not inspect user homes.
- `daemon/` runs as one mapped Unix UID and owns native discovery and child
  processes. It does not authenticate browser identities.
- `udssecure/` validates systemd-created mapped socket path ownership and root-controlled
  directory traversal at the client boundary; SO_PEERCRED on a socket bound by PID 1
  identifies root, not the daemon UID after activation. The daemon separately
  requires the connected gateway UID.
- `core/` is authority-neutral domain code.
- `contracts/` is generated from `contracts/v1/`; never edit generated files.
- `cli/` is the non-interactive operator surface and follows AI-first CLI canon v4.

Run `go generate ./internal/contracts`, `./scripts/check-generated.sh`,
`go vet ./...`, and `go test -race ./...` after changes.
