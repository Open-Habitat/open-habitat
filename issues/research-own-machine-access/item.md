---
created: 2026-10-29
updated: 2026-10-29
type: task
reporter: jari
status: open
priority: normal
lane: own-machine
lane_seq: 1
preparation: pending
---

# Research: the agent reaches the person's own computer over Tailscale + SSH, managed in the UI

_Source: chat_

## Description

Jari 29.10. (from `research-ville-feedback`, item 1): **yes**, a person's Habitat agent may reach the person's own computer. The route is **Tailscale + SSH**, and it must be handled in the product UI, not as a manual recipe. First research how this is actually supported, then prototype rounds (`proto-own-machine-access`).

Research questions: running Tailscale per Unix user without root on the server (userspace networking, `tailscaled --tun=userspace-networking --socket`, state under the person's home; does it survive restarts as a user unit; what other Unix users can see), how the person joins it to *their own* tailnet (auth URL / key flow in the browser, no tailnet admin of ours), how the agent's SSH key is created on the account and how the person installs it on their Mac/Linux/Windows machine with limits (`from=`, `expiry-time=`, a forced command or not), macOS Remote Login vs Tailscale SSH, how the person sees, pauses and revokes access, what the agent sees (`tw`-like verbs: run a command, read a file, clipboard, screenshot), and what must never happen (another Unix user reaching the tunnel; the operator reaching the person's machine). Compare with the `tw` seat channel in `~/src/fleetrepo` and with products that do remote access for agents.

## Acceptance Criteria

- [ ] `report.md` (sourced) and `result.md`: a supported architecture with its authority split (gateway/daemon/provision; Unix user boundary), the native components reused, the UI surfaces the prototype round must cover, and what Jari must decide.
- [ ] A spike on the test server or a disposable container proving or refuting unprivileged per-user `tailscaled` (no change to a shared host's network config).
