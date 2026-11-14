# Result: prototype round 1 — Storage breakdown and clean-up

Round `design-system/prototypes/rounds/2026-11-14-storage-breakdown/`. Its
`NOTES.md` covers the build, the check, what the host would need, and the
recommendation on where the Go build cache should live.

**Axis:** how the breakdown leads to clean-up. All three directions show the
same things: the warning at the top of Storage from 85 %; the known caches
(Go build, Go modules, npm, Cargo registry, Playwright, uv, pip); worktree
build directories, split into running worker, finished and main checkout;
the Trash, workspaces and agent history; and *Ask an agent to clean up…*,
which opens a new conversation (a labelled stand-in) with the request in the
field, unsent.

- **A Pylväs (bar):** production's usage bar is split into coloured groups.
  Each group opens to its items. The button sits at the bottom of the card.
- **B Vapautettavissa (freeable):** a checklist of what can be removed comes
  first, with its total. Running workers' directories are listed but
  disabled. The request carries exactly the selection. The other usage sits
  in a compact bar below.
- **C Kansioittain (by folder):** one folder table sorted by size, each row
  tagged with its kind. The button sits above the table.

**Recommendation: B.** The warning's question is "what can I free". B
answers it with a number on its first line, and the request carries what
the person saw and chose.

## Decisions for later review

- **Clean-up is done by the agent, not by a daemon delete action.** The
  alternative was a "Clean" button per cache. That would give the daemon a
  new destructive operation over arbitrary home paths. The agent route reuses
  the existing authority, and the person sees what was run.
- **Where the conversation opens:** the person chooses a workspace in the
  dialog (default: the one holding the largest build directories). A
  conversation needs a workspace, and there is no home-directory workspace.
  Alternative: a dedicated home workspace, which would be a new concept.
- **Main-checkout build directories are not freeable by default.** The
  person may be building there. B lets them tick one; A and C leave it out
  of the request.
- **The request includes each tool's own clean command** (`go clean -cache`,
  `npm cache clean --force`, …) rather than "remove". Go's module cache is
  read-only, so `rm` fails on it, and tool commands respect locks.
- **Measuring:** the result is held in daemon memory and re-measured when
  Storage opens with a result over 15 min old, when usage crosses 85 %, or
  on request. Nothing runs on a schedule. The view always shows when the
  breakdown was measured.
- **Go build cache placement:** one per-user `GOCACHE` in its default home
  location, shared by all runs and counted in the quota. Not per run and not
  in `/var/tmp` scratch. The reasoning is in `NOTES.md`. This differs from
  the issue's remark that build scratch belongs in a disposable location: a
  cache is valuable because it is reused, and outside the home it would
  escape the quota.
- In dark theme the cache and running-worker colours are both green. The
  tag text keeps them apart, but the implementation should pick a clearer
  pair of tokens.

## Questions for Jari

- Which direction (recommendation B)?
- Is the agent-only clean-up right, or do you want a direct "empty this
  cache" button for the safest entries (Go build cache, npm)?

Live check: none yet. This is a prototype round, nothing is on the test
server. Open `offline.html` from the worker results and try the three
directions in the "Yli 85 %" situation: B's checkboxes change the request
text.
