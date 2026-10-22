---
name: worktree
description: Router for the `/worktree-*` family. Reads a free-form worktree request and hands it, arguments intact, to the sibling that owns that kind of work (`/worktree-spinoff`, `/worktree-research`, `/worktree-technical-decision`, `/worktree-bug-analysis`, `/fan-out`). Use when the user invokes `/worktree <task>`, `/worktree <issue-slug>`, or `/worktree --flag ... <task>`, or says "spawn a worktree for X" / "do this in a worktree" without naming a variant. Does not create worktrees itself, and does not route to `/worktree-merge`, `/worktree-status`, or `/complex-rebase`, which act on an existing worktree and are invoked directly.
version: 1
cli_version: "0.16.0"
schema_version: 1
---

# worktree

Arguments: `$ARGUMENTS`

The user typed `/worktree` without saying which kind of worktree they want. Your
job is to work that out from their words, say in one line where you are sending
the request, and invoke that sibling skill with the arguments exactly as the user
wrote them. The sibling does everything else: it reads the issue, validates the
flags, writes the worker's brief, and creates the run. Nothing in this skill
creates a worktree, a run, a prompt file, or a branch.

Then invoke the sibling through the harness's skill loader or by reading its instructions with `$ARGUMENTS` unchanged:
the task text, any flags, in the order the user wrote them. Flags such as
`--headless`, `--tmux-session`, `--profile`, `--interactive`, or a leading
`--review` mean something specific to the sibling that receives them, and some
are not `taskfleet` flags at all but instructions the sibling folds into the
brief. Stripping, normalizing, or rephrasing here changes the brief the worker
will eventually receive, and rejecting an unknown flag is the sibling's job, with
the sibling's error message. Likewise do not expand or "helpfully" enrich the
task; the sibling owns the brief and knows what the worker needs.
