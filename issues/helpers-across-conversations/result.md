# Result

**What changed.** A conversation whose person has Avustajat on gets a short
helper recipe in its Open Habitat system prompt
(`internal/daemon/helpers-context.md`, added by `launchContext` in
`pi_rpc_linux.go` at conversation launch). It says what a helper is, gives
the one `run create --resident --name` call, how to step aside on
`resident_name_in_use`, that `run wait` settles at a round report (Taskfleet
`run/wait.rs`: `round_reported: true`), how to land, relay, message, finish,
how to list only this conversation's helpers by `created_by_session`, and what
archiving does. The experimental card's *needs* text says the agent learns it
at the next start and that a conversation sees only its own helpers.

**Visibility.** The browser was already scoped: every spinoff/helper read and
wake goes through `belongsSpinoff`, which requires Taskfleet's creator session
to equal the conversation. What the screenshot shows is the *agent* reading
Taskfleet's repository-wide `run list`, and the repository-wide name check.
`TestHelpersBelongToTheirConversation` pins the browser side for two
same-named helpers, one of an archived conversation.

**Names.** Fixed properly in Taskfleet: issue
`~/src/taskfleet/issues/resident-names-per-session` (filed unlaned through
intake, committed locally as 3410aef2, not pushed) proposes scoping resident
names by (repository, creator session) for both the uniqueness check and name
resolution, plus an optional `run list --creator-session` filter. Until then
the recipe makes the collision harmless: take `<name>-2`, leave the other
run alone, address your own helper by run id.

## Decisions for later review

- **Recipe in the system prompt, only with the switch on** (alternatives:
  the `open-habitat skill print agent` skill for everyone; a pointer line in
  the host context). Chosen because the acceptance asks for one or two calls
  and the skill costs a discovery call; gating keeps the prompt unchanged for
  people who have not turned helpers on. Cost: the switch is read when Pi
  starts, so an already running conversation learns it on its next launch.
- **Interim collision route is `-2`, not a session suffix in every name**
  (alternative: always append a short conversation id). A suffix would show
  in the chip for everyone; `-2` appears only on an actual collision.
- **Run id after create.** Name resolution is repository-wide today and could
  reach another conversation's helper; the run id cannot.
