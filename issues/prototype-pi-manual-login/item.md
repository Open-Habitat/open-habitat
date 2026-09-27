---
created: 2026-09-27
updated: 2026-09-27
type: task
status: open
priority: high
related: ['@prove-pi-browser-auth', '@design-first-use-onboarding']
lane: pi-native-patch
collision: [issues/design-first-use-onboarding/]
---

# Prototype secure Pi manual browser login

## Goal

Develop and test a narrow native Pi patch candidate for secure, listener-free OpenAI Codex browser subscription login as an isolated upstream artifact, without changing the globally installed Pi or activating any host web login yet.

## Context

@prove-pi-browser-auth/result.md pinned Pi 0.85.1 and demonstrated that the current browser path attempts TCP localhost:1455, accepts bare/missing-state manual codes, and hangs on abort. @design-first-use-onboarding/plan.md recommends a Pi-owned `ModelRuntime.login("openai-codex", "oauth", interaction)` seam that keeps PKCE, token exchange, storage and refresh native under the mapped Unix UID. Jari explicitly wants OpenAI ChatGPT subscription browser login (not API keys/device-code) before repo browsing. The user agreed to native Pi behavior, not an unreviewed custom host OAuth client. Product repo must not vendor the whole Pi module or install a local build persistently on machine.

## Acceptance Criteria

- [ ] Prepare a minimal source-level patch against a precisely pinned public Pi upstream revision corresponding to the inspected installed release. Only add an opt-in manual-only browser interaction: no listener call, exact redirect scheme/host/port/path and exactly one nonempty `code`+`state` equal to generated state, reject bare/fragment/duplicate/error, abort settles pending prompt, preserve existing TUI flow by default.
- [ ] Keep all credential exchange/store/refresh in native Pi code. Implement or supply executable deterministic tests proving listener was never invoked, strict URL/state parsing, state mismatch, abort without paste, unknown result after credential write, cross-process/logout limitations, credential non-disclosure and no real provider requests. Never read or mutate real `~/.pi/agent/auth.json`, live browser, user credentials or installed Pi.
- [ ] Provide patch file and a reproducible application/test runbook under this issue, with upstream repo URL/revision/hash, exact test commands and honest limits; independently review security-relevant diff. Do not modify product gateway/daemon contracts, publish upstream PR or mark architecture accepted. A working patch artifact is not a deployed login and must not be represented as live consent proof.
