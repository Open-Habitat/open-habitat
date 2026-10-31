---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: done
priority: normal
lane: research-per-person-gateway
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Research: a gateway instance per person

## Description

Jari 31.10.: the Cockpit benchmark (`issues/benchmark-cockpit/report.md`, lesson 4) points out that Open Habitat's single gateway process can reach every person's daemon socket (group `open-habitat-gateway`), which Cockpit's own documentation names the worst case. Research how a gateway per person could be implemented and what it would buy: SNI/host or path routing in a small front (as Cockpit's cockpit-tls and per-cert ws instances), socket activation per user, systemd template instances with DynamicUser or the person's own UID, a daemon-side cgroup/peer check, what happens to TLS, the shared origin, sign-in (OAuth callback is one URL), the editor/view hosts, websocket routing, memory cost per idle person, upgrades and Fleetrepo installation; compare with cheaper hardening of the single gateway (systemd sandbox, a written "gateway never spawns processes" rule, peer credential checks). Read the gateway code (`internal/gateway`, `internal/AGENTS.md`) and units (`systemd/`). Report in Finnish in `report.md`: options with cost and what each protects against, a recommendation, and what an ADR would decide.

## Acceptance Criteria

- [x] Finnish sourced research compares per-person gateway identities and routing with singleton hardening, records safe observations and their limits, and recommends the questions for an ADR without implementing product changes. See [report.md](report.md) and [result.md](result.md).

## Comments
