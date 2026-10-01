---
created: 2026-10-01
updated: 2026-10-01
type: feature
reporter: jari
status: open
priority: high
related: ['@build-agent-control']
lane: agent-control
lane_seq: 20
collision: [AGENTS.md, internal/daemon/, docs/interfaces.md, internal/gateway/, contracts/v1/]
---

# Answer and cancel Pi extension dialogs from the browser

## Goal

Let the browser answer and cancel a Pi extension dialog. Jari decided on
2026-10-01 (option a): real answer and cancel controls, not only cancel.

## Context

A Pi extension can open a UI request mid-turn (confirm, select, input …) and
wait for `extension_ui_response`; while it waits, the outer prompt is not
acknowledged, and an ordinary browser message cannot resolve it. Today the
browser shows the request as inert text and the only exit is Keskeytä
(see `issues/build-agent-control/result.md`, the paragraphs on
`extension_ui_response` and unknown UI requests).

## Scope

1. Daemon and contract (this issue's first slice): publish the pending
   extension UI request as a validated, typed observation (kind, prompt
   text, options, request id) and accept exactly one answer or cancel per
   request id through an explicit CSRF-bound route, forwarding
   `extension_ui_response` to Pi. Unknown request kinds stay inert text with
   cancel only. A lost or ambiguous answer is uncertain and never retried.
2. Browser (after the v2 presentation correction lands): render the dialog
   inside the conversation in the v2 vocabulary with answer and cancel.

## Acceptance Criteria

- [ ] Supported dialog kinds can be answered and any dialog cancelled from
  the browser, once per request id, with honest uncertain handling.
- [ ] Distinct-UID fake/pinned Pi fixtures cover answer, cancel, stale request
  id and a foreign user's attempt.
