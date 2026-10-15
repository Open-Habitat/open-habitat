---
created: 2026-10-15
updated: 2026-10-15
type: task
reporter: jari
status: done
priority: high
lane: agents
lane_seq: 1
collision: [docs/decisions/]
preparation: ready
closed: 2026-10-15
---

# Decide how Claude runs with a subscription

Jari, 2026-10-15: support Claude through a Claude subscription. Two candidate
paths: a Pi extension built on the Claude SDK (Jari has heard one exists; his
own Pi has `npm:pi-claude-code-ui` installed), or supporting the Claude Code
and Codex harnesses themselves as native agents next to Pi.

This is an architecture decision made with Jari: which agent processes the
daemon runs, whose native history and credentials are the truth, and what a
browser conversation means for a non-Pi harness. The research produces a
recommendation he can accept or redirect; implementation is a later issue.

## What the recommendation must answer

- Which Pi extensions or SDK paths exist for Claude, what they actually call
  (Claude Agent SDK, Claude Code CLI as a subprocess, direct API), and whether
  using a Claude subscription through them is permitted by Anthropic's current
  terms for this kind of multi-user host. Read the primary terms and SDK
  documentation, not forum summaries. Same question for Codex with a ChatGPT
  subscription, since Pi already does that.
- What running Claude Code or Codex natively would mean against the project's
  principles (`CLAUDE.md`: Unix users as the boundary, native tools keep their
  own histories, credentials and processes): their machine-readable control
  surfaces (Claude Code headless/stream-json, Agent SDK, Codex exec/app-server),
  native session storage, sign-in flow for a remote browser user, interrupt,
  steer and resume.
- What the browser contract (`contracts/v1/`) and daemon would need for a second
  harness, and how much is shared with Pi.
- A recommendation with the reasons and the main risk of each alternative.

## Acceptance Criteria

- [x] `analysis.md` in this folder answers the questions above with sources.
- [x] A draft ADR under `docs/decisions/` with status "proposed", awaiting Jari.

## Resolution

### 2026-10-15T17:14:18Z · @issuectl

Research and proposed ADR delivered; Anthropic approval required for hosted Claude subscription use, and OpenAI hosted authentication needs clarification. Decision remains with Jari.
