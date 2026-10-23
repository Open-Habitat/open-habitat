---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: conductor
status: open
priority: normal
---

# Decide how Ubuntu security updates interact with the runtime lock

## Description

The pilot installation (2026-10-23) stopped at `runtime_package_drift`: the fresh, security-updated Ubuntu 24.04 host had `zlib1g …ubuntu2.3` while the signed runtime lock had `…ubuntu2.2` (tmux also differed). ADR 0029's policy is deliberate: exact Ubuntu tool-package pins, never downgrade a security update, drift blocks convergence until a new qualified runtime lock is released. The conductor relocked for pilot.3 within that policy.

Consequence to decide: every Ubuntu security update on a customer host (unattended-upgrades runs daily) can block the next `host apply`/`host upgrade` until we publish a relocked runtime, and the runtime ships its own copies of OS libraries (like zlib1g) that the OS already maintains.

Options for Jari:
- **Keep exact locks** (today): maximal reproducibility; requires a relocked runtime release before every customer maintenance window.
- **Split platform from tools**: OS libraries that Ubuntu itself owns and security-updates (zlib, libc family, openssl…) become checked *platform minimums* (`>=` the qualified version, newer security updates accepted) and are not shipped or pinned; only tool packages the product delivers stay exact. Convergence then tolerates security updates of the platform.
- **Delegate tool packages to apt with a dated snapshot pin** per release instead of shipping debs.

Conductor recommendation: split platform from tools — it removes the routine blocker without weakening what the product actually pins.

## Acceptance Criteria

- [ ] Jari's decision recorded (ADR amendment) and the follow-up implementation filed.
