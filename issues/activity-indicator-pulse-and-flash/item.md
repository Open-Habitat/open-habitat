---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: conversation-ui
lane_seq: 2
collision: [web/src/components/conversation-message]
---

# Working indicator should pulse; transient text flashes at answer completion

## Description

Jari 2026-10-23 08:30, conversation https://open-habitat-test.example.test/workspaces/ws_b-pbqqydbKsZ6orLcbDAvWck?conversation=pi:4a019299-46e4-49ad-818f-06e3822d111c (user maintainer on the test VM):
1. The "Agentti työskentelee" indicator has a static dot; it should pulse the same way the working indicator pulses elsewhere in the UI (reuse that component/animation).
2. When the answer completed, a transient text briefly flashed below the answer and then disappeared. Find what it is from the native session and the rendering (a status/placeholder/completion row?) and remove the flash.

## Acceptance Criteria

- [ ] Working indicator uses the shared pulsing style; no transient row appears at completion (browser test captures frames around completion).
