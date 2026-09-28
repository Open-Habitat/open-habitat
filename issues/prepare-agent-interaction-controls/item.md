---
created: 2026-09-28
updated: 2026-09-28
type: task
status: in-progress
priority: normal
related: ['@build-agent-control']
lane: agent-ui-prep
collision: [design-system/, web/src/components/Conversation.tsx]
---

# Prepare agent interaction controls

## Description

## Goal
Build production React agent interaction controls that can be wired into the real Pi conversation flow once @build-agent-control reaches its integration stage. The user explicitly requested progress on agents UI in parallel with test-host and onboarding work.

## Scope
Implement a bounded, reusable UI-only slice in web/src/components/: compose/send/interrupt affordances and truthful availability, pending, acknowledged, rejected and uncertain-send states from explicit props. Preserve draft and focus across synthetic timeline updates. Show no false live Pi state and do not send requests or run a Pi process. Import the real production components in Storybook and tests, not copies. Keep current read-only history route/ConversationTimeline behavior and screenshots unchanged; avoid edits to App.tsx, history view, backend/daemon, shared root design tokens or schemas. This is preparation, not a bypass of @build-history-view visual acceptance or a claim that @build-agent-control is delivered.

## Acceptance Criteria
- [ ] Keyboard-accessible controls render Finnish text for ready, unavailable, pending, confirmed, rejected and uncertain states; uncertain send is never silently retried.
- [ ] Draft, focus and scroll/reading position survive synthetic updates; unsupported controls are disabled with a useful reason.
- [ ] Storybook states and focused component tests use the production component; no new fixture seam reaches the production bundle.
- [ ] Run ./scripts/ci-local.sh --clean --json, record exact evidence and limits in result.md, and leave visual acceptance of integrated agent control with @build-agent-control.

## Dependencies and boundaries
This component-only slice needs no native Pi transport or history acceptance. Wiring controls to native Pi, HTTP/SSE, start/resume ownership and a browser demonstration remain in @build-agent-control, which stays blocked by @build-history-view until Jari records his visual decision. If safe isolation from the history component is impossible, stop and report rather than bypass its gate.
