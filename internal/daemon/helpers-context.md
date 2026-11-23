
## Helpers

A helper (Avustaja) is a named Taskfleet resident run that belongs to this
conversation. It works in rounds in its own worktree, reports each round, and
then waits with its session kept for your next message. "Tee avustaja" asks
for one. The person talks to you and you relay; nothing in the browser lands,
messages or stops a helper.

Helpers need a Taskfleet with resident runs: `--resident` in
`taskfleet run create --help`. An ordinary run ends with its task and cannot
resume for another round, so it is no substitute; on an older Taskfleet, tell the
person this host cannot make helpers yet.

Create a helper from the repository it works in. Write a brief with the
round's task and where its result goes (Taskfleet adds the round protocol) and
name the helper after its job:

```sh
taskfleet run create --kind spinoff --resident --name reviewer --headless --title 'Catalog review' --prompt-file brief.md --output json
```

Names are lowercase (`[a-z][a-z0-9-]*`, at most 48 bytes, no doubled or
trailing hyphen) and scoped to the creating conversation in that repository,
so another conversation's helpers never collide with yours.
`resident_name_in_use` means you already have that helper: inspect it; a new
name would make a duplicate.

From then on use the returned run id. A round goes like this:

- Start `taskfleet run wait <run-id> --output json` with the process tool and
  turn notifications, set the conversation `running`, and end your turn. The
  wait settles when a round is reported (`round_reported: true`, its summary
  in `resident.last_round`), but also on attention; a timeout needs a new wait.
- Land the round with `taskfleet run land <run-id> --output json` and tell the
  person what it did. A `land_conflict` lands nothing; your next message hands
  the conflict to the helper.
- For the next round, send `taskfleet run message <run-id> --body-file
  message.md` and wait again.

When the work is done, `taskfleet run merge <run-id>` lands the last round and
ends the helper; `taskfleet run cancel <run-id>` ends one that has nothing
left to land.

To stop a helper's current work or redirect a round, interrupt it; cancelling
would end the helper. From its repository,
`taskfleet run interrupt <name> --output json` (the run id works too) keeps
its worktree, uncommitted changes and session. The wait then settles with
`round_interrupted: true`, which is not a round to land. Once the interrupt
reply shows the worker has exited, send the revised task with
`taskfleet run message` and the same helper resumes.

This conversation's runs in every repository, where a non-null `resident`
marks a helper:

```sh
taskfleet run list --creator-session current --json
```

Helpers of other conversations are theirs to manage and report. When the
person archives this conversation its helpers are hidden, not stopped; a
working round finishes. Restoring shows them again without starting a round.
