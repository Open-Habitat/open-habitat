# Result

## Cause

Taskfleet (v0.20.0, the pinned core runtime version) starts every Pi worker
as `pi <profile argv> --extension <message adapter> --session <state
root>/.creating/pi-sessions/<run>/pi-session-<uuid>.jsonl`, after its
handshake has written that file's session header with the worker's canonical
cwd. The release's `pi` launcher withheld `--approve` whenever `--session`
appeared, because a session can live in another directory. So every Taskfleet
Pi worker kept Pi's default and, with project resources in the worktree,
stopped at Pi's trust prompt. The `__worktrees` path, symlinks and the
v0.1.1 payload were not the cause: the release had the rule, and a worktree
below `~/src` passes the below-`~/src` check.

## Fix

`runtime/core/agent-bin/pi` now accepts exactly one `--session <absolute
path>` when Pi will open that session in the launcher's own directory: the
file does not exist yet (Pi then uses the process cwd), or its first line is
a session header whose `cwd` equals the canonical process cwd (the shape
Taskfleet writes). Anything else (relative path or id, two `--session`, a
missing value, `--session=`, a header elsewhere or not on the first line)
keeps Pi's default. The saved "do not trust" walk is unchanged and applies to
workers too. The independent review found that `--session-id` can open a
session recorded for another directory whose session folder name collides
with this one's; it now keeps Pi's default as well (it predates this change).

Tests: `TestLauncherAppliesDaemonTrustRule` covers Taskfleet's argv in the
`~/src/project__worktrees/feature` layout (new and header-written sessions,
headers elsewhere, saved false on the worktrees folder, outside `~/src`);
`TestLauncherPinnedPiTrustsWorkspaceSkills` runs the pinned Pi through the
launcher with Taskfleet's `--session` and sees the worktree's own skill.
Both fail on the previous launcher.

## Decisions for later review

- Visibility of a worker stuck at any startup prompt stays as it is in
  Habitat: the Workers panel already shows a Pi worker whose session has no
  task a minute after its header as awaiting input. What is missing is that
  Taskfleet's `run wait` (and its `awaiting_input`) never wakes the conductor
  for it, because Taskfleet only knows agent-emitted attention and worker
  exit. That belongs in Taskfleet (proposal carried in the run report) rather
  than a daemon-side steer into a live conversation, which would be a second
  source of run state. Alternative: have the companion's catch-up also read
  the session file; rejected because a conductor blocked in `run wait` would
  still not hear it.
- `--approve` stays process-wide: a later in-session switch to another
  directory's session (TUI resume, RPC `switch_session`) runs under it. This
  predates the change and is same-user state only.
- A person's own `pi` earlier on PATH (for example in `~/.local/bin`) still
  takes precedence over the launcher by design, and then gets no trust rule.

## Live check

On the test server, from a conversation in a repository below `~/src` that
has its own `.agents/skills`, start a Taskfleet Pi worker (`taskfleet run
create --kind spinoff …`) with no trust entry for the `__worktrees` folder:
the worker starts working at once and the Workers panel never shows it as
awaiting input. With `"<repo>__worktrees": false` saved in
`~/.pi/agent/trust.json` of a test account, the worker still starts without
a prompt but does not offer the repository's own skills (the saved decision
stands).
