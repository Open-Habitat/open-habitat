# Result: launcher applies the daemon's ~/src trust rule

The core runtime's `pi` launcher (`runtime/core/agent-bin/pi`, installed as
`/opt/open-habitat/core/agent-bin/pi`) now passes Pi's one-run `--approve`
when its canonical working directory lies strictly below `realpath($HOME/src)`
and Pi's trust store has no saved `false` for the directory or its nearest
ancestor and can be judged — the daemon's `projectTrustArgs` rule. Taskfleet's
Pi workers and terminal `pi` in a `~/src` workspace or worktree no longer stop
at "Trust project folder?"; elsewhere Pi's prompt stays.

## How it decides

- **Explicit choice:** the launcher scans every argument for Pi 1.3.0's exact
  trust words (`--approve`, `-a`, `--no-approve`, `-na`) and leaves the flag
  out when any is present. The scan does not stop at `--`, because Pi takes a
  `--` after a value flag (`--system-prompt --`) as that value (found in
  review). A message or value equal to one of the words only withholds the
  flag (fails closed).
- **Session elsewhere:** `--session` and `--resume`/`-r` also withhold it:
  they can open a session whose cwd is elsewhere, and Pi applies `--approve`
  to the session's cwd. `--continue`, `--fork` and `--session-id` bind to the
  launcher's cwd (checked in Pi's `main.js`), so they keep the flag.
- **Store:** read where Pi reads it — `PI_CODING_AGENT_DIR` with Pi's `~` and
  `file://` forms (the latter found in review), else `~/.pi/agent/trust.json`.
  Missing store → approve; unreadable, oversized (>1 MiB), malformed,
  non-object or non-boolean value → leave to Pi, as the daemon does.
- The decision is a short inline `node -e` run by the runtime's own Node; any
  error withholds the flag. Subcommands (`install`, `list`, …) are untouched.

## Checks

- `TestLauncherAppliesDaemonTrustRule` runs the real launcher with a stand-in
  Pi over the daemon's own directory and store case tables (now shared
  helpers), plus `PI_CODING_AGENT_DIR` (absolute, `~/`, `file://`) and the
  argument cases. It fails against the previous launcher.
- `TestLauncherPinnedPiTrustsWorkspaceSkills`: pinned Pi 1.3.0 through the
  launcher, RPC `get_commands`: a worktree's `.agents/skills` skill loads under
  `~/src/<repo>__worktrees/`, not outside `~/src`, not under a saved false; no
  `trust.json` written. Fails against the previous launcher.
- Live, 11.11.: the installed release Pi 1.3.0 in tmux with a synthetic HOME
  and `.agents/skills`: the new launcher in `~/src/p__worktrees/f` opened
  straight to Pi with the project skill listed; the old launcher showed
  "Trust project folder?"; the new launcher in `~/other` still showed it.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: all
  green except `TestSnapshotListsWorktreePlaces`, which fails on this host
  because Python's `referencing` module is missing (`validate-contracts.py`
  import), unrelated to this change.
- Review: `/llm-review` at critical rigor (finder gpt-6-astra, verifier
  claude-fable-5-1); two must-fix findings, both confirmed and fixed;
  `/assess-findings` table: both FIX, applied.

## Release

The launcher is a core runtime input (`scripts/core-runtime-build.py` copies
`runtime/core/agent-bin/pi`; the closure records its digest), so **the next
release needs a core runtime rebuild** (`--rebuilt`). There was no clean way
to keep it outside the runtime closure: the launcher is the program Taskfleet
and the terminal execute, so the behaviour has to live in it or in something
it calls, and the alternatives (a new file elsewhere in the runtime, the Go
binary at a release path the runtime does not know) are still runtime changes
or couple the runtime to the release layout.

## Decisions for later review

- **Inline Node in the launcher rather than a separate file or the Go
  binary.** Alternatives: a `runtime/…/trust.mjs` file (new closure entry and
  verifier rule), or calling the Go daemon code (reuses the exact function but
  ties the runtime launcher to the release binary's path). Inline keeps the
  closure unchanged apart from the launcher's bytes; a test holds parity with
  the daemon. Cost: one extra Node start (~tens of ms) per `pi` launch.
- **`--session` / `--resume` withhold the flag.** Alternative: approve anyway
  (convenient for `pi -r` within ~/src). Chosen because Pi would apply the
  approval to a directory the launcher never judged, possibly overriding a
  saved false.
- **Runtime directory switches are not covered.** Once interactive Pi is
  running with `--approve`, Pi applies it to every directory it switches to
  (e.g. `/resume` into a session from another project). The launcher cannot
  see that; documented in `docs/operations.md`. Closing it would need Pi to
  scope `--approve` to the start directory.
- **Pi's `defaultProjectTrust: "never"` setting is not consulted**, as in the
  daemon: the decided rule names saved per-directory decisions only, and
  `--approve` outranks the setting. A person who set it globally gets
  approval in `~/src` anyway; revisit together with the daemon if wanted.
- **`HOME` decides `~/src`** (Node's `os.homedir()`, which Pi also uses),
  where the daemon uses the account's home; they coincide in Habitat.
