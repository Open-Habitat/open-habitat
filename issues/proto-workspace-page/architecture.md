# Workspace page: host facts it needs (proposal)

A proposal for Jari, not an accepted ADR. The prototype in
`design-system/prototypes/rounds/2026-10-16-tyotilasivu/` shows Git state that
the snapshot does not carry today. This note says where that data would come from.
None of it changes which component holds authority.

## What exists

`snapshot.workspace.git_summary` already gives the branch, the number of changed
files and the GitHub repository. `kind` separates main and linked worktrees.
`git_remote` classifies the origin. Agents carry `title`, `activity`,
`started_at` and `archive`, and recaps come from `conversation.recap.generate`.
The page's conversation lists, archive, recap cards and the "+" layer's
Keskustelu item work from these facts alone.

## What is new

| Fact on the page | Native source (run by the daemon as the user, in the checkout) |
| --- | --- |
| Changed files with M/U/D and line counts | `git status --porcelain=v2` plus `git diff --numstat`, capped at about 50 entries, with a "+N more" count beyond the cap |
| Ahead/behind the upstream | `git rev-list --left-right --count @{upstream}...HEAD`; absent when there is no upstream |
| "Origin tarkistettu 6 min sitten" | mtime of `.git/FETCH_HEAD`. The daemon never fetches by itself, because fetching would need the user's credentials and network on the page's behalf |
| Recent commits (subject, short hash, time, whether it is pushed) | `git log -n 5 --format=…` and membership in `@{upstream}` |
| A conversation's last activity ("8 min") | the newest entry in the Pi history the daemon already reads, or `activity` |
| Linked worktrees and their agents | `git worktree list --porcelain` for the paths, plus the Taskfleet run/node binding from ADR 0010 and `manage-agent-worktrees`. That round (`proto-worktree-agents`) defines the binding |

## How it would be served

The data would be read on demand, when the workspace page or the Git layer
opens. A query such as `workspace.git_detail` would sit beside the snapshot,
not inside it. The snapshot already sends `git_summary` for every workspace, and
a file list and commit list for every workspace on every snapshot would be wasted
work. The daemon reads native Git each time and does not cache or store the
result: Git is the only store. Reads are bounded by the entry caps above and by a
timeout. A timed-out or failed read is reported as unknown ("Gitin tilaa ei
saatu luettua"), never as a clean tree.

## Boundary

The reads run as the workspace owner's Unix user, inside a workspace that user
already owns, with the same Git binary and configuration they use over SSH.
They pass no credentials, do no network I/O and write nothing. The gateway
receives no new authority. Paths go to the browser exactly as Git reports them,
so they stay copyable to a terminal.
