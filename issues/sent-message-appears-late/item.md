---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
lane_seq: 3
preparation: ready
---

# A sent message takes up to a second to appear in the conversation

_Source: chat_

## Description

Jari 29.10. (Birch, pilot.14): when he writes a message while the agent is doing something (perhaps at other times too), the sent message takes up to about 1000 ms to appear in the conversation. A sent message should show immediately.

## Acceptance Criteria

- [ ] Cause found and measured (browser optimistic rendering vs. waiting for the host/native echo; busy vs. idle agent; queued steering message).
- [ ] The message appears without a perceptible delay in both states, or the remaining delay is explained.
- [ ] Regression test (browser spec timing on the synthetic host where feasible).
