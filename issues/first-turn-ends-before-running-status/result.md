# Result

## Decision

A first turn whose saved final reply is read **before** any status says the
run is active is drawn finished and stays finished. A status that lags behind
it does not revive the turn, so it shows no "Näytä työ · Agentti työskentelee"
row. The product is unchanged. The spec now states this rule instead of
assuming every first turn is drawn running.

## What actually happens

The frames from failing runs show two shapes of the same lag:

- the saved final reply is drawn first, and only then does the status say
  "running" for one read. This is the shape the issue describes;
- the status says "running" while no turn row exists at all, because no
  streamed part has arrived yet. The turn's first row is then the finished
  reply.

In both cases the turn is never drawn unfinished while the status says it
runs, so the turn-end hold (`timelineItems`'s `wasRunning`) has nothing to
hold. A first attempt keyed only on "Stop shown before the final reply" still
failed 2 of 60 runs on the second shape.

## Spec change

`web/tests/lab-first-message-flicker.spec.ts` records in each frame how many
agent turns are drawn and whether the final reply is
(`stage-reply[data-reply-role="final"]`, a role `AgentTurn` gives only to a
turn that is not working). The activity-line expectation now branches:

- if a turn row was drawn unfinished while the composer showed the running
  mode (`steer`), the activity line must appear. From then on it must match
  Stop exactly, as before;
- otherwise the turn was drawn finished, and no activity line may appear.

The checks for layout shift, remounting and the message position are
unchanged.

## Evidence

`OH_CPU_THROTTLE=6 OH_REPLY_DELAY_MS=250`, lab config, `OH_BROWSER_WORKERS=2`,
`--workers 2`:

| run | before | after |
| --- | --- | --- |
| `--grep "390 creating" --repeat-each 60` | 4/60 failed at the activity line* | 60/60 |
| whole file `--repeat-each 10` (4 cases) | — | 40/40 |
| whole file `--repeat-each 5`, no throttle | — | 20/20 |

\* That run also failed 32/60 on layout shift. This was a regression in this
branch's own intermediate store change, which made the "status out of date"
warning flash. The change was reverted (see `altogether-wanting-children`).
On the pre-branch base, the same case failed 1/30 at the activity line and
never on shift.

Logs are in `/var/tmp/agent-keep/test-stability-v4b6/i5-*.log`.

## Decisions for later review

- **A turn that ended before its first running status gets no activity
  line.** The alternatives were (a) to treat the newest turn after the
  person's own just-sent message as running while the status says so, or (b)
  to accept the drawn-finished turn. Option (a) changes the authority rule
  that `turn-end-jitter` chose: a status read would revive a reply already
  drawn as final. It would also add a working row for a turn that is visibly
  done, so the person would see the answer, then "agent working", then the
  answer again. With (b), the one remaining inconsistency is that the composer
  shows Stop beside the finished reply for a single status read, until the next
  status ends the run. That is the status being honest about its own lag, and
  it lasts one read. Chosen: (b).
- **No working row while the status says running but nothing has
  streamed yet** (the second shape). A placeholder row driven by the status
  alone would show "agent working" for runs whose first visible thing is the
  finished answer, and it is a design question about the activity line, not a
  test fix. Left as it is.
