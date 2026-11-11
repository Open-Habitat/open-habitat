---
created: 2026-11-11
updated: 2026-11-11
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed by worker while implementing pi-project-trust-in-browser
source_ref: taskfleet:01m74hj95b5wh9kgr9h1r113pn/observation:launcher-trust-prompt
originating_run: 01m74hj95b5wh9kgr9h1r113pn
originating_run_kind: spinoff
---

# Taskfleet Pi workers in ~/src repositories with project skills stop at Pi's trust prompt

## Description

Observed 11.11.2026 while implementing `pi-project-trust-in-browser` (Birch, core
runtime Pi 1.3.0): starting the release's `pi` launcher
(`/opt/open-habitat/core/agent-bin/pi`) interactively in a directory below
`~/src` that has `.agents/skills/<name>/SKILL.md`, with no
`~/.pi/agent/trust.json`, stops at Pi's full-screen prompt:

```
Trust project folder?
<home>/src/p
This allows pi to load .pi settings and resources, install missing project packages, and execute project extensions.
→ Trust / Trust parent folder / Trust (this session only) / Do not trust / ...
```

Why it matters: browser conversations in `~/src` now start Pi with `--approve`
(daemon, `internal/daemon/project_trust_linux.go`), but Taskfleet's Pi workers
are started through this launcher as interactive Pi in tmux, in worktrees under
`~/src/<repo>__worktrees/`. For a browser-only person (no saved trust decision)
spawning a spinoff in a repository that has its own `.agents/skills` or `.pi/`
resources, the worker's first screen is this prompt instead of the brief. Nobody
is attached to answer it; whether Taskfleet's brief injection happens to select
an option is unverified. The browser shows the worker as running/waiting. Not yet
observed with a real Taskfleet spawn.

Direction to decide: apply the same rule in the launcher (pass `--approve` when
`pwd -P` is below `$HOME/src` and no saved `false` applies, leaving `pi` in the
Habitat terminal either the same or prompting), or have Taskfleet pass
`--approve`/`--no-approve` for its unattended workers. Jari's 11.11. decision
covered the daemon's launches only.
