---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: own-machine
lane_seq: 3
preparation: ready
blocked_by: ['@account-keys-page']
---

# Own computer over Tailscale + SSH: guided setup, several machines

_Source: chat_

## Description

Implement `proto-own-machine-access` direction **Ohjattu** (Jari 29.10.): a guided setup that joins the person's own tailnet with a per-user unprivileged `tailscaled` (userspace networking, socket in `$XDG_RUNTIME_DIR`, `--shields-up` always), installs the agent's SSH key line on the person's machine with `restrict`, `from=` and `expiry-time=`, and confirms the connection. Jari's additions: **another machine can be added afterwards**, and machines have **meaningful names, taken from Tailscale** (the device's MagicDNS/host name). No pause button. The UI says plainly that the agent gets everything the person's user has on that machine and that the server's root can technically use the grant. Uses the account SSH key from `account-keys-page`. Research: `issues/research-own-machine-access/` (report, result, decision notes).

## Acceptance Criteria

- [ ] `tailscale` in the runtime profile; per-user user unit with the two safe overrides proven by a second-UID test.
- [ ] Guided flow with every state of the prototype, several machines, Tailscale names; the agent can reach a connected machine with ordinary `ssh <name>`.
- [ ] Contract, daemon and browser tests; operations.md; KOKEILTAVAA line.
