---
created: 2026-10-21
updated: 2026-10-21
type: feature
reporter: jari
status: open
priority: normal
related: ['@agent-cli']
lane: agent-cli
lane_seq: 2
collision: [agent-cli]
preparation: ready
---

# Agent CLI slice 1: own-UID agent socket, environment/workspace/current reads, agent skill, canon repairs

_Source: chat:agent-cli-2026-10-21_

Implements the first slice of ADR 0027 (`docs/decisions/adr-0027-agent-cli-route.md`, accepted by Jari 2026-10-21). Scope and details: [implementation notes](../agent-cli/adr-0027-notes.md), sections A, C, E, F and slice 1; the surface inventory is in [research](../agent-cli/research.md).

Deliver:
- The `agent.sock` listener: a second systemd socket unit for the daemon, own-UID peer check, default-deny route table sharing the daemon's operation implementations and `contracts/v1` schemas; cold activation from either socket keeps the first queued request; deployment and Fleetrepo socket restoration updated.
- `open-habitat agent environment show`, `agent workspace list`, `agent conversation show --current`, canon-conformant (`--json`, exit codes, dry-run where applicable); quota read as the daemon's own UID through `storagequota.Read`, reported unavailable on failure; daemon version and CLI version separately.
- Launch context: the daemon sets conversation, workspace and launch generation in Pi's environment; `--current` resolves and fails on a stale generation.
- The `agent` skill through `skill print agent`, version-matched, pointed to from host context.
- Shared canon repairs: §2 exit documentation, §14 drill-down help with examples, §8/§18 bare `config`/`doctor` for the personal configuration with nonzero error exits, §24 deferral references re-verified; `CONFORMANCE.md` updated from `project-canon review --profile cli --run <binary>` and `/cli-canon`.

Done when: distinct-UID tests prove rejection and the absence of gateway-only routes on `agent.sock`; contract scenarios for the agent socket exist beside CT-001/002; the three commands work from a native Pi session and from a plain shell of the same user on the test server, with a real quota reading; the agent surface passes the canon review with the remaining gaps named; ADR 0027 rules that the code cannot show are moved into the nearest `AGENTS.md` and the record removed per `docs/AGENTS.md`.


## Acceptance Criteria

- [x] Own-UID/default-deny agent listener, paired descriptor startup, read commands and native launch context implemented.
- [x] Distinct-UID cold queued requests and root/gateway/other-user denial verified; contract and package checks pass.
- [x] Critical independent security review and findings assessment completed; confirmed findings fixed.
- [x] Shared CLI help/personal diagnostics and agent skill implemented; canon residuals named in CONFORMANCE.md.
- [ ] Fleetrepo installs/gates/restores both socket instances and the test server passes real Pi/plain-shell/quota acceptance.

Implementation and exact Fleetrepo follow-up: [result](result.md). Keep this issue
open until installed-host acceptance is complete; the worker did not edit Fleetrepo
or deploy an incompatible two-socket binary to the one-socket installation.
