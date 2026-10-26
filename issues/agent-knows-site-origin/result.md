# Result

`open-habitat agent environment show --json` now has a `site` object:
`{"state":"available","origin":"https://…","source":"site_origin_file"}`, or
`{"state":"unavailable","reason":"site_origin_unavailable",…}` when the file is
missing or untrusted. The Pi host context and the agent skill tell the agent to
build browser links (settings pages, `/auth/github/start`) from `site.origin`
and to say the address is unknown rather than guess.

## How the origin reaches the daemon

Host apply and upgrade already publish root-owned, world-readable operator files
under `/opt/open-habitat` in `finishGeneration` (`pi-runtime.json`,
`editor.json`), and daemons read them with `core.ReadOperatorFile` (root-owned
ancestry, no symlinks, single link). `site-origin.json` (`{"origin": gateway.origin}`)
is published the same way, so it reaches every installation at its next apply
or upgrade. No authority moves: the gateway is not involved, the broker does not
learn the origin, and the daemon only displays it. No systemd unit, socket or
Fleetrepo site field changes, so no Fleetrepo change is needed.

## Decisions for later review

- A separate file rather than a field in the broker-written per-user daemon
  config: changing that file would mean rewriting committed bindings, which the
  broker must never do, and an origin change would need a per-user rewrite.
- Not in `applyUnitPolicies`: that set is snapshotted per generation in
  `unit-policies.json` and compared on upgrade, so adding to it would block
  upgrading from older generations.
- `site` is a required field in the contract (unavailable when absent) rather
  than optional, so the agent always sees an explicit state.
- Review dropped one confirmed but RARE finding: a root-declared origin
  containing a non-breaking space would pass the daemon's check while the
  schema pattern forbids it. Such an origin cannot serve sign-in at all.

## Validation

- `./scripts/test-focused.sh --area contracts` — passed (generated contracts regenerated).
- `--area go` for `./internal/daemon`, `./internal/host`, `./internal/cli` — passed.
- `--area web` — passed.
- New `site_origin_linux_test.go`: strict parsing rejects http, paths, credentials, query, fragment, unknown fields, trailing documents; a user-writable file is reported unavailable.
- Not tested live: the root-owned file on a real apply/upgrade (ordinary Go tests cannot create root-owned ancestry).
