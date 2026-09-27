---
created: 2026-09-27
updated: 2026-09-27
type: task
status: done
priority: high
related: ['@design-first-use-onboarding']
lane: onboarding-auth
collision: [issues/design-first-use-onboarding/]
closed: 2026-09-27
closed_by: agent
---

# Prove native Pi browser subscription seam

## Goal

Prove an isolated, Pi-native browser subscription login seam suitable for the first-use web flow before writing any credential-handling product implementation.

## Context

@design-first-use-onboarding/plan.md finds installed Pi 0.85.1's OpenAI Codex browser login opens a fixed localhost:1455 listener and accepts manually pasted bare codes without state. The product requires mandatory Pi ChatGPT subscription browser login before repo browsing. This proof must be synthetic and cannot mutate the installed Pi, real user home, auth.json or a live OpenAI account. The proposed design is not yet an accepted security architecture.

## Acceptance Criteria

- [x] Negative branch: pinned 0.85.1 provider has no manual-only option; executable synthetic tests reproduce bare/missing-state acceptance, listener bind attempt/fallback and pending-prompt abort failure. Narrow upstream patch proposal in result.md. Stale URL and wrong UID/session protection are **unproved** without a patched provider and host binding.
- [x] Synthetic ModelRuntime login uses isolated temporary HOME/PI_CODING_AGENT_DIR and auth paths; all fetches mocked, no live endpoint. Demonstrated creation modes, post-write sync failure and actual cross-process logout race. Temporary contexts share one actual Unix UID; **two-UID isolation and a working timeout remain unproved**.
- [x] result.md records pinned paths, commands, outcomes, unproved distinctions and an implementation stop condition. No host architecture approval.
- [x] Isolated tests pass; only this issue directory changed, so the repository-wide CI conditional was not triggered. No live sign-in or deploy.
