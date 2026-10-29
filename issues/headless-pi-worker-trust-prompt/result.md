# Result

Two parts, as the issue says.

**Habitat shows that the worker does not progress (fixed here).** Taskfleet
creates the worker's Pi session file and Pi writes its header at start and
the task as soon as it sends it. The daemon's reading of the live Pi session
(`internal/daemon/spinoff_activity_linux.go`, added for
`idle-interactive-worker-pulses`) now also says *blocked* when the session has
held only its header for a minute: the run's state is `idle` with
`awaiting_input` set. The worker view then says *Odottaa vastausta
päätteessä* with the existing *Worker odottaa vastausta päätteessä* card and
its *Näytä pääte* button (which, with `worker-terminal-wrong-pane`, shows the
pane where the prompt is); the panel row says *odottaa vastausta
päätteessä*, and the rail stops pulsing (*Worker odottaa sinua*). Test:
`TestLiveWorkerStateReadsPiOwnSession`.

**The prompt itself (Taskfleet).** Pi 1.3 prompts for project trust in any
cwd with `.agents/skills` or `.pi` resources that `~/.pi/agent/trust.json`
does not cover; Taskfleet's builtin Pi command is plain `pi`, so every fresh
worktree of such a repository prompts on an account that has not trusted an
ancestor (every Habitat user: the browser's RPC Pi never records a decision).
Filed in Taskfleet as `essentially-vulgar-wealth` (intake, unlaned),
proposing that the worktree inherit the source checkout's trust decision as
`--approve` / `--no-approve`. Nothing in Habitat's Pi settings can fix it
without granting trust the person never gave.

## Decisions for later review

- **Detection by the session, not the screen.** Header-only for a minute
  means Pi has not sent its task, whatever holds it; reading the pane for
  the trust prompt's words would name the cause but needs a tmux read per
  live worker on every snapshot. The card already says the answer is at the
  terminal.
- **One minute grace.** Pi normally writes the task within seconds of start;
  a slower start only shows the card early.
- **No Habitat-side trust.** Alternatives were writing the worktree (or
  `~/src`) into `trust.json` or setting `defaultProjectTrust`; both grant Pi
  trust over project code the person never approved, a security decision.
