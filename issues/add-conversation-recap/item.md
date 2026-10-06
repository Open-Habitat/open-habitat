---
created: 2026-09-20
updated: 2026-10-06
type: task
status: done
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp', '@apply-pi-block-design']
lane: ui-foundation
lane_seq: 50
collision: [docs/, design-system/, web/src/components/]
preparation: ready
closed: 2026-10-06
closed_by: agent
---

# Bring Pi conversation recaps to the browser

Bring the conversation recap Jari already uses in Pi's TUI to the browser.
It helps someone returning to a long conversation see where the work stands
and what they might do next. TUI use is the evidence of need; this is an
implementation task, not a preliminary design exercise.

## Starting point

Use the existing Fleetrepo Pi extension
`dotfiles/src/.pi/agent/extensions/conversation-recap/` as the behavioral
starting point: recap prompt and bounded history, model call outside the active
conversation context, sanitization, native session entry, manual `/recap` and
automatic generation when the TUI loses focus and work is idle. The browser is
not the TUI: check how the running native Pi session exposes those entries and
triggers through the daemon before adapting focus or idle behavior. Do not
pretend that a tab losing focus means the agent is idle, or create a separate
browser-owned history. If an automatic trigger cannot be supported honestly
in the browser yet, deliver the working request path and record the precise
gap rather than inventing a second recap engine.

## First browser version

Implement a requestable recap and present its native result as a short card
separate from the conversation transcript, with a suggested next step that
remains a suggestion. Make generation, failure, age and staleness legible;
a newer turn must not be silently represented by an old recap. Give the
browser view its first visual design using the existing shared components and
tokens. Jari can review the implemented view and refine it afterwards; no
external designer round or prior visual approval is needed.

Preserve native ownership of history and the account's agent processes. Use
the existing authenticated browser-to-daemon boundary for reads and requests;
account for model-call cost, concurrent requests, refresh and reconnection
without duplicating or losing a native result. Compare the TUI and browser
behaviors, including what happens after a restart, and state any difference
clearly. The [architecture](../../docs/architecture/index.md) describes the
ownership boundary; [L7](../native-agent-host-architecture/ui-design-later.md)
is the earlier UI follow-up, not a separate approval gate.

## Completion

A person can ask for a recap in the browser, see the resulting card or an
understandable failure, and still find it after reopening the same native
conversation. A later turn visibly makes an old recap stale. Tests cover the
native integration and browser states; the issue records the implemented
revision, model-call and persistence limits, and a visual example for Jari's
later review. Automatic behavior either follows the native source reliably
or is an explicitly bounded follow-up.

## Acceptance Criteria

- [x] A browser-controlled Pi can generate a native recap and reopen it as a separate card with a suggested next step.
- [x] Pending, failed, uncertain, aged, and stale results are legible; a newer native turn does not silently retain a current badge.
- [x] Concurrent requests and retries do not duplicate the native entry or model call for the same turn.
- [x] Native and browser tests pass; the visual example and bounded automatic-generation gap are recorded in [result.md](result.md).

## Resolution

### 2026-10-06T07:43:29Z · @agent

Native Pi recap request and browser card validated at 0ddbe38; result.md records limits, visual evidence and the automatic-trigger gap.
