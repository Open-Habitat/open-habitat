---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: proto-processes
lane_seq: 2
collision: [design-system/prototypes/rounds/proto-processes-blocks]
preparation: ready
---

# Prototype riff: process blocks, completion wake-ups and waiting states

Riff round after Jari's evaluation of `proto-processes` (round `2026-10-16-prosessit`) on 2026-10-16. Read its result.md, Jari's Decisions, `issues/extend-process-ui/{native-processes,architecture}.md`, and the current conversation states in `web/src/components/agentPresentation.ts` (for example "Odottaa sinua") and `design-system/design.md`.

Jari:
- The placement is direction 3, **Kentän yllä**, with a **"Poista päättyneet"** button that clears finished processes.
- Prototype **the block where the agent starts a process** (the `process` tool call in the thread).
- Prototype **the block where the agent learns that a process has finished**. It comes in two ways: (a) as steering ("ohjaus") while the agent is working, and (b) when the agent is Valmis / Odottaa sinua, where the completion **triggers new activity**, so the agent wakes up and starts a turn.
- **New states in the state model.** When the agent's turn has ended but its processes are running, it is in fact *waiting for its processes*, not waiting for you. The same applies when it is waiting for a worktree (spinoff) agent.
- **Waiting for a worktree is in practice just a process, `taskfleet run wait`, and it should be shown in its own special way**: as the spinoff it waits on, with that spinoff's state, rather than as a generic process.

Show all of this in the sidebar and home-page state marks, the top bar, the recap and the thread. Keep it consistent with `proto-spinoff-agents` (round in progress, `2026-10-16-*` spinoff round), which shows the spinoffs under their parent conversation; read it if it has landed, and otherwise state the shared assumptions in result.md.

Update `issues/extend-process-ui/architecture.md` where needed: how the daemon learns about a completion and a wake-up natively, how the "waiting for processes / worktree" state is derived without a host store, and how `taskfleet run wait` is recognised.

## Acceptance Criteria
- [ ] Round verified with check.mjs (light, dark, phone, interactions), with all the listed blocks and states.
- [ ] architecture.md updated.
- [ ] `result.md` per the prototype worker rules, including the proposed state-model additions as a table.
