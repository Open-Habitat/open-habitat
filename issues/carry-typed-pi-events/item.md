---
created: 2026-10-03
updated: 2026-10-03
type: feature
reporter: jari
status: open
priority: high
lane: client-history
lane_seq: 60
---

# Carry Pi's typed events and history to the browser

## Jari's decision (2026-10-03)

The browser currently loses much of what Pi records and streams. This must be fixed, and the browser must work from Pi's original typed shapes rather than from today's flattened history.

## Problem

[The Pi event catalogue](../catalog-pi-events/analysis.md) shows the loss precisely (section E). History reaches the browser as five flattened kinds (`user`, `assistant`, `tool`, `model_change`, `unknown`; `internal/daemon/history_linux.go`, `contracts/v1/history.schema.json`): thinking, images, tool arguments and results, usage, stop reasons, local `!` executions, compaction and branch summaries, thinking-level changes, labels and visible extension messages do not cross as structured data. During a turn only text deltas and tool name/status survive (`internal/daemon/pi_events_linux.go`), not thinking deltas, tool-call argument streaming or tool results.

## Goal

The daemon passes Pi's session entries, message content blocks and live events to the browser in their typed form, as Pi defines them at the pinned 0.85.1, and the browser store keeps them. Native history stays the only truth; this changes what the daemon reads from it and forwards, not where it is stored.

## Scope

- `contracts/v1/history.schema.json` and `event.schema.json` describe the typed entries, roles, content blocks and live events from the catalogue, with generated clients; no compatibility with the flattened kinds (pre-release).
- `internal/daemon/history_linux.go` and `pi_events_linux.go` forward those shapes, keeping existing paging, byte bounds, `entry_key` and the journal; large fields (base64 images, long outputs, summaries) stay bounded, with the existing separate content reads where needed.
- Decide per field what must not reach the browser. Provider diagnostics, raw error payloads, hook data and arbitrary extension `details` get a security review before being surfaced (catalogue section E); hidden `display:false` extension content is not shown merely because it is on disk. Unknown future types keep a safe fallback.
- The browser store and current components consume the typed data without losing what they show today. Visual design for each block is @design-pi-event-blocks; this issue only needs a correct, unstyled-but-readable rendering, so nothing typed is silently dropped.

## Acceptance criteria

- [ ] Every event/entry/content type in the catalogue either crosses the contract typed, or its exclusion is recorded with the reason.
- [ ] Deterministic tests with synthetic Pi sessions and live event sequences cover each type, very large fields and unknown types.
- [ ] The browser shows thinking, tool arguments and results, images, local commands, compaction/branch summaries and session markers from history and live, without regressions in warm switching or paging.
- [ ] TESTING.md checks pass.
