# Result

The rail now gives the person the turn over a service the agent left running.

- The daemon's branch scan (`internal/daemon/process_interrupted_linux.go`)
  records `turnAt`: the time of the newest person message that follows a
  finished turn. The snapshot (`snapshot_linux.go`) marks each `waiting_on` item
  whose process started before that with `before_turn: true`. This is a new
  optional field in `contracts/v1/snapshot.schema.json`.
- The browser's `waitedFor` (`web/src/components/agentPresentation.ts`) decides
  which waits keep a conversation in *Odottaa taustatyötä*: every Taskfleet wait,
  and a plain process without `before_turn`. The rail, the home card, the return
  view and the conversation's own status all go through the same rule.
- A row whose services run on shows a small muted ring and says *Taustalla
  käynnissä: nimi* in its description.

Hillakoneen käyttöönotto: `proc_6b7c` started at 10:22:36Z and the person wrote
again at 10:28, 10:29, 10:31 and 10:47. With this change the process is
`before_turn`, and the conversation is in Sinun vuorosi as a read reply.

## Checks

- `go test ./internal/daemon` (full package) and contract validation passed;
  new tests: `TestBranchScanSeesWhenThePersonBeganTheTurn`,
  `TestProcessWaitingMarksWaitsBeforeTheTurn`.
- `./scripts/test-focused.sh --area web` passed; new tests in
  `railNow.test.ts` (ended turn + service → your turn; open turn → running;
  wait started within the turn → running; Taskfleet wait → running; mixed)
  and `HomeWorkspaces.test.tsx`.
- Browser (`OH_BROWSER_WORKERS=2–3`): `rail-groups.spec.ts` (new case), and
  `worker-badges`, `rail-now`, `rail-running-after-done`,
  `rail-turn-returns` all passed.
- Review: `/llm-review` (gpt-6-astra, routine). One finding, which was
  confirmed and fixed: the home card named unfiltered waits.

## Decisions for later review

1. **The rule: does the person write after the process starts?** A waking
   process keeps the conversation running only when the agent started it
   within the latest turn, meaning after the last person message that began a
   turn. Once the person has written again and the agent has answered, the
   process is something left running, not something the turn ended to wait
   for.
   - Alternatives considered: name patterns (`serve`, `watch`); a flag set by
     the agent (`service: true`) in pi-processes, which would need agent
     discipline and an extension change; a time limit (for example 30 minutes);
     reading the agent's last message.
   - Why this one: it uses a fact Habitat already has, needs no
     cooperation from the agent, and matches what the person has seen: they
     spoke with the agent after the process started.
   - Known miss: a build that the agent started, followed by the person asking
     "how is it going?", gives the person the turn even though the agent still
     waits for the build. The row still shows the process.
2. **Taskfleet waits always count as work**, however old. A `run wait` waits
   for a worker run, which is work by definition, and a busy worker keeps the
   row in Käynnissä anyway.
3. **A steer is not a new turn.** A person message that goes into an open
   turn does not move `turnAt`, because the agent's turn still owns the
   processes it started. A follow-up delivered after the turn does start one.
4. **The daemon states the fact and the browser decides.** `before_turn` is a
   fact about the timing, and the rule that turns it into a rail group lives in
   `waitedFor`. Changing the rule needs no change to the contract.
5. **The row's mark** is a muted still ring (`.ah-nav-service`), not the accent
   ring used for *Odottaa taustatyötä*, so that it does not suggest work the
   person waits for.
