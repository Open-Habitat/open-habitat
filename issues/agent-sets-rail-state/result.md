# Result (17.11.2026): the agent chooses its conversation's rail section

Implemented as Jari decided on 17.11.: after its reply the agent can place its
own conversation in any of the three sections with

    open-habitat agent section update --current --section yours|running|quiet --json

No text appears on the row and the rail looks as before. Without a choice
nothing changes.

## How it behaves

- **yours** (Sinun vuorosi): same as no choice; the reply claims the person's
  turn.
- **running** (Käynnissä): the reply does not claim the person's turn while
  Habitat sees the conversation's work going on (a worker working, or a process
  the agent waits on). When that work ends without a new turn, the reply moves
  to Sinun vuorosi like any reply.
- **quiet** (Hiljaiset): the reply does not claim the person's turn. If work is
  still going on, the row stays in Käynnissä until it ends, then goes to
  Hiljaiset.
- **The choice belongs to one turn.** The next turn (the person writes, or a
  worker's completion wakes the agent), an accepted message and an archive
  remove it.
- **What wins over it:** the person's Nosta and Ei nyt, a native Pi question, a
  running turn, a crash or cut turn, and a turn that ended in an error.

## The guidance the agent gets (Jari 17.11.: the most important part)

The text is in the Habitat host context, which every browser conversation's Pi
reads (`internal/daemon/host-context.md`, section Conversations), and in more
detail in the agent skill (`internal/cli/agent/SKILL.md`). In short:

- **yours** when it needs or offers something to the person: a question, a
  decision or a result to read. This is the default after every reply, so the
  agent seldom needs to say it.
- **running** when it has work in flight that it will report on itself
  (workers it started, a wait or job), and the reply asks nothing yet: "I
  started the workers and will report back".
- **quiet** only when there is a reason, usually that the person asked for it
  ("laita tämä hiljaisiin"). Never on its own judgement that nothing seems
  pending; a finished answer belongs in Sinun vuorosi.

## Decisions for later review

- **Command shape.** `agent section update --current --section …`, with no
  `--conversation` and no `show`. Alternatives: an explicit conversation ID, a
  read command. Why: the agent places only its own conversation; the snapshot
  already shows the stored choice to the browser. `--dry-run` is refused as
  `dry_run_unsupported`, because the only effect is a per-turn choice and a
  repeat reports no change.
- **Only during the conversation's own running turn.** The daemon refuses
  with `conversation_not_running` outside one and with `current_context_stale`
  for an older launch. Alternative: allow it any time. Why: the choice
  describes the reply of the turn it is made in, and a leftover background
  script should not re-place a conversation that has moved on.
- **What the choice binds to: the turn, not a reply ID.** The daemon clears it
  at Pi's next `agent_start`, at a message Pi accepts (choices made before the
  message was sent), and on archive. Alternative: bind it to the reply ID
  written at turn end. Why: Pi writes the final reply after the agent's last
  tool call, so the reply ID is not known when the command runs; Pi's own
  turn start covers wakes the daemon did not send. A steer accepted mid-turn
  clears only choices made before it was sent; a choice made just after it
  stays until the next turn. A conversation continued in a terminal Pi
  outside the daemon keeps the choice until the daemon next sees a turn.
- **running when nothing runs.** It falls back to Sinun vuorosi at once, with
  no timer. Alternatives: hold it until the next reply or for a fixed time.
  Why: a forgotten or wrong `running` can then never hide a reply longer than
  the observed work, and the rail needs no clock. Work Habitat cannot see
  (an external CI) therefore does not keep the row in Käynnissä.
- **A worker waiting at its own prompt does not count as work** for
  `running`, since it waits for a person.
- **Where it is stored.** Beside the person's turn marks in
  `~/.config/open-habitat/turn-marks.json`, as a separate `sections` map
  (section and time only), so that neither replaces the other. Up to 256
  choices; under the file's byte bound the choices give way before the
  person's marks. The record is deliberately just *section + time*, so the
  planned scheduled wake can later move a conversation from Hiljaiset to
  Sinun vuorosi by writing or replacing the same kind of choice. Nothing of the
  scheduling is implemented.
- **A failed turn ignores the choice.** The snapshot leaves the choice out
  when the branch ends in an error turn, and railNow ignores it whenever a
  failure is shown. Why: the choice describes a reply, and a failed turn has
  none.

## Checks

- Contracts: `./scripts/test-focused.sh --area contracts` (new
  `agent-section.schema.json`, snapshot field, negative cases).
- Go: `./scripts/test-focused.sh --area go --go-package ./internal/daemon` and
  `./internal/cli` passed: validation and authority refusals, storage beside
  the person's mark, idempotent repeat, supersession at turn start, at an
  accepted message and with a late receipt, the byte bound, the failed turn in
  the snapshot.
- Web: `railNow.test.ts` covers each choice with and without running work, a
  background wait, the person's marks, a question, a running turn and a failed
  turn.
- Browser: `web/tests/agent-section.spec.ts` (the quiet choice moves the row to
  Hiljaiset, holds through a reload, Nosta wins, the next turn claims Sinun
  vuorosi), with `raise-to-your-turn`, `worker-badges` and
  `rail-interrupted-turn`, `--repeat-each 3`, 2 workers: 15 passed.
- Review: an independent `/llm-review` (gpt-6-astra finder, claude-fable-5-2
  verifier) and `/assess-findings`. All four findings were fixed (repeat lost
  to a pending clear, a late receipt clearing the new choice, choices crowding
  out marks, quiet hiding a failed turn), plus the verifier's two residuals.

Live check: on the test server, ask the agent in a conversation to put it in
Hiljaiset ("laita tämä hiljaisiin"); after its reply the row is in Hiljaiset.
Ask it to start a long background job and report back; the row stays in
Käynnissä while the job runs.
