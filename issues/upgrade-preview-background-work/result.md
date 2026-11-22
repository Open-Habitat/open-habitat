# Result

The daemon answers a work census, `open-habitat agent work show --json`
(`GET /agent/v1/work`, contract `agent-work`). It lists what stopping the
daemon would cut. For each conversation it gives the activities its handle
holds: `turn`, `question`, `command` (a `!command` the person ran),
`habitat` (title, recap, Habitat's own wake, the settle window) and
`unknown`. It adds `processes` with the labels of Pi background processes
that still run, as the process bridge reports them, or `unknown` when the
bridge does not answer clearly. Handle-less jobs are listed too:
`history_title` (a history named without a handle), `clone`, and
`workspace_operation` (the workspace writer is held, e.g. a publish's push).
Handles are read whether or not the rail can place their workspace.
`heldActivity` is now derived from the same `heldWork`, so the limit,
deletion, archive and idle stop read conversations exactly as before.

The upgrade (`internal/host/upgrade_native_linux.go`, `readDaemonWork`) reads
the census from the predecessor first. `active_turns` counts every
conversation held by anything other than processes, plus every job;
activities and job kinds it does not know count too. `background_processes`
is counted separately. `active_work` names each item, and `work_census`
records whether the counts came from `daemon`, `list_only` or `unavailable`.
The old list is read only when the predecessor CLI itself refuses `agent work
show` with `invalid_arguments`, which the daemon's census never answers. Any
other failure, or a reply without the census schema, is unobservable.

Tests: `internal/daemon/work_census_linux_test.go` (turns, background
processes running/unknown/finished, command, held command, title, recap,
settle window, handle without a workspace, handle-less title work through a
real `historyTitle`, a held workspace writer, input refusal, `heldWork` vs
`heldActivity`; each reply is validated against the schema) and
`internal/host/upgrade_work_linux_test.go` (every kind, the contract example,
and the fallback decision table).

## Decisions for later review

- **Background processes do not hold the quiet window.** A preview server
  runs until someone stops it, so waiting for it would block every
  unattended upgrade. Such processes are counted in `background_processes`,
  each conversation's process labels are named in `active_work`, and the plan
  gets the action `upgrade.background_processes` / `background_processes_stop`.
  Interruption consent is still required for every live daemon.
  Alternatives considered: treat them as active (an upgrade would never run
  unattended while one exists); ignore them (they would be cut without being
  named).
- **The plan names a process by Pi's label, never its command line.** A
  command line can hold a secret, and root's plan output gets copied into
  logs. Labels are capped at 80 characters.
- **Unknown blocks.** An unclear process bridge, an unreadable controller
  state, an activity or job this release does not know, and a conversation
  listed with no activity all count as active. A bridge that never answers
  therefore holds the quiet window until someone looks at it. This is the
  fail-closed choice the brief asked for.
- **A predecessor without the census uses the list, marked `list_only`.**
  Marking it unobservable would have blocked every unattended upgrade from
  today's releases, which is the original incident turned inside out. The
  plan says what the counts rest on, and from the release that ships the
  census as predecessor onward, the census is read. Only the CLI's
  `invalid_arguments` refusal selects the list.
- **The `active_turns` name is kept** although it now counts more than
  turns, so that an installer already reading it waits for the new work
  without changes.
- **Not counted:** the list-only Pi that `helperCommands` starts to list slash
  commands (read-only and short; cutting it loses nothing); workspace icon
  suggestion (a 45-second model helper; review finding F2, dropped under rule
  1b because the overlap is rare and the person can ask again); long-lived
  daemon services that restart with the daemon (integration sync clients,
  the Microsoft MCP child, the server browser). Taskfleet workers and
  terminal Pi stay out of scope, because the upgrade does not stop them.
- **Brief holders of the workspace writer count too.** Annotation writes
  hold it for milliseconds and only move the window by a poll; telling them
  apart from a push would need a list of reason codes that would drift.

## Review

Rigor: critical, because this is the upgrade's safety gate (daemon state, a
new agent route, a contract). `/llm-review` used gpt-6-astra as finder and
claude-fable-5-2 as verifier, 2 calls. `/assess-findings` then sorted the
two confirmed findings. F1, a repository publish's push of up to 45 minutes
invisible to the census, was fixed by adding the `workspace_operation` job.
F2, the icon suggestion helper, was dropped under rule 1b. Nothing was filed.

Checks: `./scripts/test-focused.sh --area go` for `./internal/host`,
`./internal/daemon` and `./internal/cli`, and `--area contracts`, all
passed. The census tests also ran under `-race`.
