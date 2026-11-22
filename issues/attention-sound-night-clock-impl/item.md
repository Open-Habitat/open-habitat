---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-night-clock-impl
lane: attention-night
lane_seq: 2
preparation: ready
closed: 2026-11-22
---

# Night quiet follows a clock window, shown at the top of Sounds

## Description

Implement Jari's choice C in attention-sound-night-visible (22.11.2026): night quiet follows a clock window (default 22–7) instead of the device's dark mode; a status line at the top of Settings › Äänet says when sounds are silent because of night; no one-night override.

## Acceptance Criteria

- [x] An editable, account-wide local-clock window replaces dark-mode coupling and preserves existing night on/off choices.
- [x] The Sounds status line offers permanent disabling and the clock editor; previews explain their bypass and the account menu shows the same state without reordering.
- [x] Focused web, daemon, contract and browser checks pass, including midnight/DST boundaries and repeated browser runs; independent review findings are assessed and resolved.

## Tests Run

Commands, results, review and synthetic evidence are recorded in [result.md](result.md).
