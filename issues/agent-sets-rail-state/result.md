# Design result (14.11.2026)

The design is in [worker-asks-parent/design.md](../worker-asks-parent/design.md),
written together with the worker-question flow because the two meet in the
rail: §2 covers this issue (the `open-habitat agent handoff` command, which
states the agent may declare, what stays Habitat's observation, expiry and
override, trust), §2.4 how a worker's open question and "needs your answer"
combine, and §3 the phasing, where this issue is slice 1 and needs nothing
from Taskfleet.

Nothing is implemented. The issue stays open with preparation pending until
Jari has reviewed the design; its decisions for later review (§5) and open
questions with recommendations (§6) are in the design.

Review: focused self-review against the code (`web/src/app/railNow.ts`,
`internal/daemon/turn_marks_linux.go`, `notices_linux.go`,
`process-extension.mjs`, `process_interrupted_linux.go`).

Live check: no test-server behaviour changed; there is no handoff command to
try yet.
