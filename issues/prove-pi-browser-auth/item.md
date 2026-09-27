---
created: 2026-09-27
updated: 2026-09-27
type: task
status: open
priority: high
related: ['@design-first-use-onboarding']
lane: onboarding-auth
collision: [issues/design-first-use-onboarding/]
---

# Prove native Pi browser subscription seam

## Goal

Prove an isolated, Pi-native browser subscription login seam suitable for the first-use web flow before writing any credential-handling product implementation.

## Context

@design-first-use-onboarding/plan.md finds installed Pi 0.85.1's OpenAI Codex browser login opens a fixed localhost:1455 listener and accepts manually pasted bare codes without state. The product requires mandatory Pi ChatGPT subscription browser login before repo browsing. This proof must be synthetic and cannot mutate the installed Pi, real user home, auth.json or a live OpenAI account. The proposed design is not yet an accepted security architecture.

## Acceptance Criteria

- [ ] Build a disposable source-level/packaged-Pi test harness (in this issue directory, not a global install) against the pinned installed source/version. Verify whether an upstream/reviewed Pi capability can run browser OAuth with NO TCP listener and only an exact full redirect URL with validated state; prove abort when no paste, expired/stale input and wrong UID/session cases with synthetic provider responses. If none exists, provide a narrow upstream Pi patch proposal and reproducible failing tests; do not claim success.
- [ ] Prove the proposed Node ModelRuntime seam can use isolated PI_CODING_AGENT_DIR and mock network/browser callbacks without leaking credential values across two disposable HOME/UID contexts. Never contact real OpenAI endpoints. Confirm timeout, partial credential-write and cross-process logout limitation.
- [ ] Write result.md with pinned paths, exact commands, outcomes, supported-vs-unproved distinctions, and an implementation prerequisite/stop condition for the host. Do not change production gateway/daemon contracts yet or mark an unproven trust boundary approved.
- [ ] Run appropriate isolated proof tests and ./scripts/ci-local.sh --clean --json if repo code/contract is modified; no live sign-in or deploy.
