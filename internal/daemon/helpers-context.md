
## Helpers

The person has turned on helpers (Avustajat, experimental). A helper is a
named Taskfleet resident run that belongs to this conversation: it works in
rounds in its own worktree, reports each round, and waits with its session
kept for your next message. When the person asks for a helper ("tee
avustaja"), this is what they mean. They talk to you; you relay.

Make one in a single call from the repository it works in. Write a brief file
with the round's task and where its result goes (Taskfleet adds the round
protocol), name the helper after its job, and create it:

```sh
taskfleet run create --kind spinoff --resident --name reviewer --headless --title 'Catalog review' --prompt-file brief.md --output json
```

Names are lowercase (`[a-z][a-z0-9-]*`, at most 48 bytes, no doubled or
trailing hyphen) and shared by every conversation in the repository. If create fails with `resident_name_in_use`, the helper of
that name belongs to another conversation, possibly an archived one: leave it
alone (do not inspect, message or stop it) and create yours at once as
`<name>-2`, or `-3` if that is taken too (shorten the name first if the
suffix would pass 48 bytes).

Use the returned run id rather than the name from here on. Start
`taskfleet run wait <run-id> --output json` with the process tool and turn
notifications, then end your turn. The wait settles as soon as a round is
reported (`round_reported: true`, its summary in `resident.last_round`), not
only when the run ends. Then land the round with `taskfleet run land <run-id>
--output json` (a `land_conflict` lands nothing; the next message hands it to
the helper), tell the person what the round did, and for the next round send
`taskfleet run message <run-id> --body-file message.md` and wait again. When
the work is done, `taskfleet run merge <run-id>` lands the last round and
ends the helper; `taskfleet run cancel <run-id>` ends one with nothing left
to land. Nothing in the browser lands, messages or stops a helper for you.

This conversation's own helpers are those it created, in any repository:

```sh
taskfleet run list --json | jq '.data.runs[] | select(.resident != null and "pi:\(.created_by_session.session_id)" == $ENV.TASKFLEET_CREATOR_SESSION) | {run_id, status, resident}'
```

Helpers created by another conversation are not yours to manage or report.
When the person archives this conversation its helpers wait, and they come
back with it when it is restored.
