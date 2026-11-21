# Result

`activeTurns` in `internal/host/upgrade_native_linux.go` now reads the history
catalog: a row with a controller `state` is decided by that state (empty or
unfamiliar counts as active); a row without state is history or a native
writer outside the daemon and counts 0; an unknown or missing lifecycle counts
as active; a reply without `schema_version: 1` and a sessions list is
unobservable. Tests cover resting, archived and live stateless rows, daemon
states, the contract example, malformed replies and the 135-row report.

## Decisions for later review

- **Native writers and archived rows do not count as active turns.** The issue
  asked not to treat archived rows as idle blindly, because archive hides a
  live external writer. The upgrade cuts only daemon children
  (`KillMode=mixed`; docs/operations.md: SSH/tmux/Taskfleet Pi keep running),
  and those always appear with a controller state when they have a handle. So
  neither a visible (`live`) nor a hidden (`archived`) external writer is work
  the upgrade cuts. Alternatives: count live/archived stateless rows (blocks
  every unattended upgrade on a host running Taskfleet or terminal Pi, which is
  the incident again); add a writer field to the list (helps only once a
  predecessor ships it, and still not work the upgrade cuts). The daemon is
  unchanged.
- **The count rests on what the predecessor list can say.** Review confirmed
  that the list cannot see daemon work behind an idle state (browser bash,
  naming, settle window, Pi background processes), handle-less title work, or a
  controller whose workspace vanished. Previously masked because no host with
  history ever looked quiet. Consent is still always required for a live
  daemon. Filed as `overly-capricious-fish` (untriaged) with the direction: a
  daemon work census route the upgrade reads when the predecessor offers it.

## Review

`/llm-review` (finder gpt-6-astra, verifier claude-fable-5-2; 2 calls) and
`/assess-findings`: 4 confirmed findings, all pre-existing limits of the
predecessor list; 1 spin-off (filed), 3 dropped by rule 1b (rare/never-emitted
null state). The comment on `activeTurns` was corrected to state those limits.

Checks: `./scripts/test-focused.sh --area go --go-package ./internal/host` and
`--go-package ./internal/daemon` passed.
