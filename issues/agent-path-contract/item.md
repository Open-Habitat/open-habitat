---
created: 2026-10-15
updated: 2026-10-15
type: feature
reporter: jari
status: in-progress
priority: normal
related: ['@test-server-tooling']
lane: daemon
collision: [internal/daemon]
---

# Agent PATH with each user's own bin and the administrator's shared tools

Decision by Jari, 2026-10-15 (`issues/test-server-tooling/item.md`, research in `research.md`): every user has their own bin directory on the agent's PATH, and shared tools are installed by the administrator with ordinary Linux administration.

Implement the daemon's command search path for browser-started Pi and the processes it runs. The daemon assembles it as the user, from the trusted account home, never from browser or gateway input:
- `$HOME/.local/bin` first;
- then the administrator's shared tools (`/usr/local/bin`, root-owned);
- then `/usr/bin:/bin`.

The host's own fixed subprocesses (`gh` for host GitHub actions, git calls) keep their absolute paths and sanitized environment. The PATH must match what the same user gets in a native SSH login shell, so that agents find the same tools in both.

## Acceptance Criteria
- [x] Browser-started Pi finds an executable placed in the user's `~/.local/bin` and in `/usr/local/bin` (Go test with a disposable HOME, plus a lab or browser journey).
- [x] A user's `~/.local/bin` never appears in another user's PATH or in root/gateway/broker processes (test with two UIDs, or the closest synthetic proof, stating its limits).
- [x] Host-fixed subprocesses still use their absolute paths (test).
- [x] The operations guide (`docs/operations.md`) gets a short section: where users install their own tools, and how administrators add shared ones.
- [x] result.md has a "Decisions for later review" section.
