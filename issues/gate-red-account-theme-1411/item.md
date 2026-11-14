---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
source_ref: conductor:2026-11-14/gate-6154634c
lane: gate-red
lane_seq: 2
preparation: ready
closed: 2026-11-14
---

# Clean gate red on main: account-settings and theme cases after the settings changes

## Description

## Observed (14.11.2026)

Clean gate on main `6154634c` (after the storage breakdown and the
settings-layout fix landed): ordinary browser suite 651 passed, 3 failed;
lab 234 passed; Go, contracts, web checks passed.

- `tests/account-settings.spec.ts:83` — verified native state, route return and explicit disconnect
- `tests/account-settings.spec.ts:516` — @a11y compact phone drawer and settings separate list/detail screens
- `tests/theme.spec.ts:43` — Korkea kontrasti is a fourth choice, and Järjestelmä picks it when the device asks for more contrast

Likely touched by `e38da04c`/`46b4d772` (theme chooser width in
`Account.tsx`) or the storage breakdown (`83a0c2ec`, account settings).

## Acceptance Criteria

- [x] Reproduce each reported case alone and identify the responsible change.
- [x] Preserve the narrow theme chooser and verify each corrected journey passes 3/3 alone.
- [x] Record focused validation and the live check in result.md.
