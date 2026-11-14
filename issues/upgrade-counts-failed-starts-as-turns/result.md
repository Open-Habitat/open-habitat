# Result

Fixed the upgrade inventory's settled-state classification. `start_failed`
was missing from the excluded states even though the daemon retains failed
starts for recovery without a running turn. It now contributes zero active
turns. Unfamiliar states still count as active; unavailable inventory handling
is unchanged. Every live daemon still requires explicit interruption consent.

Validation:
- `umask 077; scripts/test-focused.sh --area go --go-package ./internal/host` — passed.
- `scripts/test-focused.sh --area contracts` — passed.
- Regression tests cover failed starts, other settled states, starting/running,
  unfamiliar/empty states, and consent with observable or unobservable turns.
- Independent review by claude-fable-5-2, with gpt-6-astra checking the upgrade
  consent boundary, followed by local assessment: no actionable findings.
  This level was chosen because the fix touches upgrade reporting.

Live check: not performed; no installed binary or live daemon was changed.
Native UID/systemctl inventory integration was inspected, not exercised by the
unit tests. The correction ships in the successor performing the upgrade;
external installer workarounds for older targets remain outside this change.

## Decisions for later review

None. This restores existing settled-state semantics without changing upgrade
approval or security boundaries.
