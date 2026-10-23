---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: conductor
status: done
priority: normal
closed: 2026-10-23
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

## Decisions

### 2026-10-23T07:39:20Z · @jari

Jari 2026-10-23: 'It is not this product's job to maintain Ubuntu.' Packages that Ubuntu itself provides and security-updates (git, tmux, zlib, libc family, openssl, ffmpeg, pandoc, php, …) come from the host's own Ubuntu apt with its normal security updates; the product declares them as required packages with minimum versions and checks them, never ships or exact-pins them, and never blocks on newer Ubuntu versions. The product ships and exact-locks only what Ubuntu does not provide (Node/Pi, uv, Python 3.14, Playwright browsers, the Microsoft adapter, …). This amends ADR 0029 (offline exact Ubuntu tool-package closure; no package solver at install time).
