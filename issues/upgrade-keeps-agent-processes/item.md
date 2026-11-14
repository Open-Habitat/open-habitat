---
created: 2026-10-25
updated: 2026-11-14
type: task
reporter: jari
status: open
priority: normal
preparation: pending
lane: pi-holder
lane_seq: 1
---

# Upgrades that do not kill running agent processes

## Description

Jari, 2026-10-25: research how installing a new version could take over running agent processes, or at least not kill them, along with the person's other processes. Context: Jari will run the project's conductor inside Maalla Habitat (Birch). Releases to Birch are deliberate milestones, and the test server takes the frequent releases, but a Birch upgrade should still not cut live work.

Observed on Birch (pilot.11): the per-user daemon unit `open-habitat-daemon@<user>` has `KillMode=mixed`, `PrivateTmp=yes` and `NoNewPrivileges=yes`. Pi conversations are the daemon's children, so they and anything they start (for example Taskfleet supervisors, tmux servers and workers started from a conversation's bash tool) live in the daemon's cgroup and private `/tmp`. Restarting the daemon on upgrade ends them. The browser shell's processes live in the user manager's `open-habitat-tmux.service` and are not affected by a daemon restart, but whether an upgrade restarts that unit too is unverified.

## Goal

Research and recommend, as an architecture proposal for Jari:
- which processes an upgrade must stop (product binaries, units) and which it must leave alone (agent turns, user tools, background workers);
- how conversations and their tool processes can outlive a daemon restart and be reattached, for example by running Pi in the user manager or tmux rather than as daemon children, a handover or socket-activation pattern, or `systemd-run --user` scopes for long-lived children;
- what a live upgrade does to an in-flight agent turn, and how the person sees it;
- the trade-offs against the Unix-user boundary and the existing upgrade operator (fenced operation, staged owner).

Verify the current behaviour first: start a long-lived child from a conversation, and check what a daemon restart and a real upgrade do to it on the test server.

## Acceptance Criteria

- [x] The current behaviour is verified on the test server (which processes die on upgrade, with evidence): [research.md](research.md), section 2.
- [ ] A recommendation with options, decided by Jari (ADR), followed by implementation issues.

## Decisions

### 2026-10-30T07:11:02Z · @jari

Jari 30.10.: On tavallaan ok, että prosessit kuolevat päivityksessä; ne säilytetään vain, jos sen voi tehdä ilman ylimääräistä monimutkaisuutta. research.md: vaihtoehto A (host upgrade jättää käyttäjämanagerit rauhaan) on jo tehty; ainoa vaihtoehto, jossa käynnissä oleva vuoro jatkuu (B, keskustelukohtainen pi-host-pitäjä ja uudelleenkytkentäprotokolla), on iso. Siksi lykätty; herätys ja joutilaan Pi:n säilyttäminen (wake-stopped-conversation-on-run-settle) kattaa käytännön haitan.
