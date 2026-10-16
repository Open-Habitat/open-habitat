---
created: 2026-10-15
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-processes
lane_seq: 1
collision: [design-system/prototypes/rounds/proto-processes]
preparation: ready
closed: 2026-10-16
---

# Prototype: agent processes in the browser

Jari 15.10.2026: every new feature is prototyped first; the working prototype Jari accepts is its specification, and implementation waits for his evaluation. The round is made in its own worktree under `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the `prototype` skill. Alongside it, an architecture sketch says how the server side would do it, in a separate file, following the project principles in `CLAUDE.md` (Unix users as the boundary, native tools own their history, credentials and processes; no parallel store or broker). The sketch is a proposal for Jari, not an accepted ADR.

Jari wants process support modelled on the Pi extension he uses in the terminal, `npm:@aliou/pi-processes`. The research of what it records natively lands in `issues/extend-process-ui/native-processes.md` (run `01m508r1ae4xv4p3wtd9x03a9a`); start from it. Cover: seeing that the agent has processes running, the inventory, one process's output with live follow and pausing, stopping a process, and what happens to processes when the conversation ends or the daemon restarts.

## Acceptance Criteria
- [ ] `issues/extend-process-ui/architecture.md`: daemon reads and controls as the mapped user, contract additions, lifecycle.
- [ ] Round verified with check.mjs; `result.md` per the prototype worker rules.

## Decisions

### 2026-10-16T05:46:20Z · @jari

Jari 2026-10-16: direction 3, Kentän yllä, with a 'Poista päättyneet' button. Riff round proto-processes-blocks follows: the block where the agent starts a process; the block where the agent learns that a process finished (both as steering during a turn and as a trigger that wakes an agent that is Valmis / Odottaa sinua); new states in the state model ('waits for processes', 'waits for a worktree'); and taskfleet run wait shown in its own way.
