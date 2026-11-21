# Result: minimal Microsoft relay

Implemented in `1ed6f8b6` (baseline `7c8a4120`). The existing
`open-habitat mcp-relay microsoft …` entry now **execs**, rather than spawns,
`open-habitat-mcp-relay` beside its own resolved executable. Existing account
entries and the permission hook need no migration. No product process stays
resident beside the relay, and no PATH lookup or mutable generation selector
chooses the helper.

The helper calls the same `msmcp.Relay`: private home socket, own-UID peer
checks on both ends, no TCP, no credential copy and the same own-user daemon
wake request. The daemon's binding resolution and single-child ownership are
unchanged.

## Footprint: four real conversations

Linux arm64, `TestMicrosoftFootprintLab`, production endpoint and relay, one
real pinned Microsoft server, four real Pi processes with a synthetic,
unsigned-in account. No provider operation or model turn. The endpoint is
hosted in the test binary as it is hosted in the daemon. Measurements are
snapshots after each conversation's 3-second settle, not a load/leak test.

The final after measurement uses the relay and main executable extracted from
the **release package**, not a stand-alone experimental build. MiB:

| Four conversations | Before | Packaged after |
|---|---:|---:|
| Native Microsoft processes | 1 | 1 |
| Relays | 20 | 20 |
| Mean relay RSS | **20.4** | **3.7** |
| All relays RSS / PSS | 408.9 / 189.8 | 73.6 / 19.7 |
| Native Microsoft RSS / PSS | 118.0 / 115.0 | 128.9 / 125.8 |
| Endpoint-host RSS growth | 5.5 | 6.7 |
| **Whole MCP side RSS / approximate PSS** | **532.4 / 310.3** | **209.1 / 152.1** |
| Pi, separately, RSS / PSS | 518.7 / 338.6 | 516.1 / 338.1 |

About **335 MiB less relay RSS**, and **323 MiB less total MCP-side RSS**
(61%). The native server varies between snapshots; the relay reduction is
not inferred from its memory. The lab's total PSS uses endpoint-host RSS
growth as its endpoint estimate, as the earlier lab did; the native and relay
PSS columns are actual `/proc` measurements. An earlier after run measured
200.1 MiB total RSS and the same 3.7 MiB mean relay RSS.

The packaged-after progression for one through four conversations was
181.9, 202.0, 187.9 and 209.1 MiB MCP-side RSS, with 5, 10, 15 and 20
relays and exactly one native process. The lab now fails on any different
process count, including a retained launcher beside each helper.

Evidence: `/var/tmp/agent-keep/microsoft-relay-footprint/` contains
`before/footprint.json`, `after/footprint.json`, `packaged/footprint.json`,
initialization traces, test logs and the review/assessment. No captures or
installation data were committed.

## Release and deployment

- Both Linux release targets build and ship `bin/open-habitat-mcp-relay`
  as mode 0755, covered by `MANIFEST.sha256` and the archive digest. Releases
  retain the existing digest-pinned trust model; no signing system was added.
- The verifier requires the helper and checks its digest, inventory, mode and
  ELF target. Negative cases cover omission, corruption and wrong architecture.
- Successor descriptors authenticate its installed name
  `open-habitat-mcp-relay`. The operator verifies it, binds its digest into
  the product observation, stages it beside the main executable and records
  it in the generation inventory. A retained older predecessor manifest is
  still readable; an incoming successor without the helper is refused.
- The operator guide and changelog describe the additional executable.
  **External installers must map the installed helper name to
  `bin/open-habitat-mcp-relay`, include it in the authenticated product closure,
  and preserve mode 0755 beside the real main executable.** An external
  verifier that only maps/counts the main executable will refuse this release.
  The exact private operator change is handed to the conductor in
  `discussion_items`; no external repository was edited.

## Decisions for later review

- **Separate helper rather than broad lazy initialization.** `GODEBUG=inittrace=1`
  measured roughly 9 MiB of allocations spread across daemon, integrations,
  gateway, host, CLI and provider packages, not one isolated initializer.
  Lazifying those unrelated packages would widen this task. The tiny helper
  reaches the memory goal without changing their behavior.
- **Keep the existing public command as an exec trampoline.** Directly rewriting
  every account entry to the helper was the alternative. Exec avoids another
  migration and permission-hook change while eliminating the resident product
  heap. Main-binary initialization still occurs transiently at startup; this
  change targets steady-state memory, not startup allocation or latency.
- **Require the helper, never fall back to the heavy relay.** A partial install
  fails clearly instead of silently losing the memory improvement. Native
  host checks and the release verifier catch the missing file before activation.

## Checks and review

All required focused checks passed on the source now committed as `1ed6f8b6`:

- `scripts/test-focused.sh --area go --go-package` for `./internal/msmcp`,
  `./internal/cli`, `./internal/host` and `./internal/daemon/integrations`.
  The latter ran the before/after labs and then the packaged-after lab.
- `scripts/test-focused.sh --area contracts`: generation clean; 106 schemas,
  170 fixtures and 44 scenarios valid.
- `TestUpgradeProductRelay`, compiled through the focused runner, executed as
  root in a disposable networkless container: both archive and generation
  layouts pass; missing, altered, symlinked, foreign-owned, noncanonical-mode
  and unlisted helpers fail (14 cases). This is real filesystem trust evidence,
  not a full generation installation or systemd upgrade.
- `scripts/package-release.sh`: two byte-identical archives each for
  linux-amd64 and linux-arm64, using a minimal synthetic web entry. Both verify;
  the arm64 binaries execute natively. The amd64 embedded identity check is
  explicitly unverified on this arm64 host. These test packages were built
  before the code commit and stamp baseline HEAD `7c8a4120`; they are not
  publishable release artifacts or clean-gate receipts.
- `scripts/test-package-socket.sh`: pass for both final architecture archives,
  including the new helper rejection cases. `scripts/test-package-fixture-guard.sh`:
  pass. `python3 scripts/test-cloud-qualify.py`: 22 tests pass, including an older
  predecessor and a successor missing the relay.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: pass.

Critical-rigor targeted `/llm-review`: claude-fable-5-2 finder and
gpt-6-astra verifier, two calls, followed by `/assess-findings`. One confirmed
finding: missing operator instructions for custom installers. Fixed in the
operator guide/changelog and handed off as the external deployment prerequisite.
No remaining code defect was found at the release/exec boundary. The finder's
ad-hoc test exceeded the documented socket-path limit; the required focused
runs use a short TMPDIR and pass. Performance-corpus logging was omitted to
honor this worker's no-push/no-external-edit rule.

Not claimed: a live installation upgrade, real Microsoft consent or tool calls,
new distinct-UID socket evidence, a browser suite or the full clean gate. Socket
security code was not changed. No user-facing UI was changed or deployed, so
no private try-it entry was added. Deployment waits for the conductor's external
operator update; the package and native host changes are ready for it.
