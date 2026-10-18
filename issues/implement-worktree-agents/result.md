# Result: worktree agents (Yläpalkissa)

ADR 0025's creation half is implemented. A worktree agent is an ordinary
browser conversation in a linked Git worktree of the workspace; the daemon
makes the branch and worktree from the first message, and merging or
discarding is asked of the agent while the top bar, rail and workspace page
show what Git says. `docs/architecture/workspaces.md` ("Worktree agents")
describes the behaviour; `http-api.md` and `conversations.md` say where place
IDs are accepted.

## What changed

- **Daemon** (`internal/daemon/worktree_places_linux.go`): every discovered
  main checkout's registry entries become *places* when the checkout is below
  home, not itself directly under `~/src`, and its `.git` file points back to
  the entry. A place has an opaque ID (`ws_…` from the workspace ID and entry
  name); `workspaceFD` falls back to it, so start, resume, held sends,
  continuation, archive, history title and the Git detail and fetch routes
  accept a place ID wherever they accept a workspace ID, resolved from a fresh
  discovery and pinned by descriptor. Conversation create takes
  `new_worktree: {name}`: under the `~/src` writer lock and after a capacity
  check, `git worktree add --no-track -b wt/<name> ~/src/<ws>__worktrees/<name>
  <current branch>` as the user (hooks off), then
  `branch.wt/<name>.workmux-base`, then Pi starts in the place. The reply
  carries the place as `workspace_id` and the workspace as `worktree_of`.
- **Snapshot**: `workspace.worktrees` (place ID, entry, name, path, branch,
  and for places with conversations `git_summary` and `branch_moved`, whether
  the branch's reflog has more than its creation entry); `agent.worktree_id`
  for a session whose header cwd is a place. A directory directly under
  `~/src` holding only registered worktree checkouts is hidden as their
  container (judged from the registry). Taskfleet-owned worktrees are not
  places. A place without a recorded base or `origin/HEAD` compares with its
  local upstream, else the main checkout's branch (`gitBase.source: local`),
  as the cleanup list does.
- **Contract**: the above fields, `gitSummary`/`worktreePlace` defs, the
  `new_worktree` input, the `local` base source, example and two negative
  checks; regenerated packages.
- **Browser**: *Uusi worktree-agentti* (branch-with-plus) on the workspace
  page's icon row opens `?conversation=new-worktree`, an empty conversation
  that says what the first message creates (base branch, uncommitted changes
  left behind, merge by asking the agent). The first send names the branch
  from the message's first words and creates; held messages carry over as for
  any new conversation. A conversation in a place gets a place workspace
  (`placeWorkspace`) so its top-bar chip reads the worktree: worktree glyph,
  branch, ↑/↓ against the base and changes, or *yhdistetty* once Git has the
  moved branch in its base with nothing uncommitted (`worktreeMerged`). The
  rail shows a worktree or merge glyph before the title; workspace-page cards
  show `wt/… → base` with counts or *yhdistetty*. Archive and history title
  name the place.
- **Lab**: the fake Pi commits on "commitoi" and merges its branch into the
  recorded base in the main checkout on "yhdistä", with native Git.

## Evidence

- Go: `go test ./internal/daemon ./internal/gateway` pass (48 s). New
  `worktree_places_linux_test.go`: creation (clean checkout of the base,
  workmux-base recorded, uncommitted changes left behind, suffix on a taken
  branch or directory, detached HEAD and invalid name refused, writer lock
  held elsewhere refuses without creating), place resolution through
  `workspaceFD` and a cleanup fence refusing a start; snapshot (container
  hidden, a container with other content shown, conversation association,
  fresh / committed / merged summaries and `branch_moved`, Git detail by place
  ID, local base fallback, an over-long branch omitted), every snapshot
  validated against the schema.
- Contracts: `./scripts/test-focused.sh --area contracts` pass.
- Web: `--area web` pass; new `worktreeAgent.test.tsx` (name derivation,
  create reply must be a place of the asked workspace, merged only after the
  branch moved, browser ownership by place) and a merged/fresh chip case in
  `GitStatus.test.tsx`.
- Browser: new `lab-worktree-agent.spec.ts` (@worktree-agent @a11y): create
  from the page, first message creates and commits, chip
  `1 edellä ja 0 jäljessä status-rivit-haaraa`, details path, axe on page and
  layer, ask to merge, chip/rail/card say *yhdistetty*, a second *Uusi
  worktree-agentti* opens empty, archive returns 200, phone view. The whole
  lab suite passed 50/50 (before the review fixes); after them
  lab-worktree-agent, lab-git-status, lab-workspace-page,
  lab-sidebar-default (icon-row count updated 6 → 7) and
  lab-worktree-cleanup pass. Normal browser suite: 237 passed, 3 skipped,
  4 failed; `account-settings` native key (known), `browser-conversation`
  warm controlled return and `clone-page` interrupted clone also fail on
  `main` in a disposable worktree; `phone archives directly` and a queued
  command case passed on rerun (the first run overlapped my App.tsx edits
  under the Vite dev server).
- Screenshots (`screenshots/`): lab `desktop-1-new`, `desktop-2-working`,
  `desktop-3-merged`, `desktop-4-page`, `phone-merged`; prototype
  (Yläpalkissa) `prototype-new`, `prototype-conversation`,
  `prototype-merged`, `prototype-page`.
- Review: one independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) and `/assess-findings`: five confirmed findings, all
  fixed with tests in this branch (new-worktree route reopened the previous
  creation; creation not serialised with workspace deletion; capacity checked
  after creation; over-long branch invalidated the snapshot; places lacked the
  ADR's base fallback). Two candidates dropped (same-UID symlink race; a
  crafted start in a Taskfleet place, unreachable from the UI). The
  model-performance entry could not be written (SSH from alder to itself
  refused, the known `assess-models-alder-self-ssh`).

Limits: synthetic lab and same-UID tests only; not run on the test server or
with a real Pi. Concurrent create/delete is covered by the shared lock, not a
race test.

## Differences from the prototype

- No settlement controls or layer (Jari's decision): the chip opens the
  existing Git details, now for the worktree.
- The chip shows the full branch (`wt/…`) and *yhdistetty*; the prototype
  showed the slug.
- No lifecycle event rows in the timeline ("Worktree-agentti alkoi",
  "Yhdistetty …"): nothing is stored to draw them from, and Git's reflog is
  not read for them.
- A merged worktree conversation is not folded into *Valmiit* by its Git
  state; the rail folds by Pi's state as for any conversation. The glyph turns
  into the merge mark.
- The intro names the base branch but not its commit hash; the workspace
  page summary does not count worktree agents.

## Decisions for later review

- **Base recorded as `workmux-base`, not as upstream.** ADR 0025 says the
  branch records its base as its upstream; an upstream equal to the base makes
  the top bar drop the base comparison and with it "merged". The branch gets
  `branch.<b>.workmux-base`, which the top bar and cleanup list already read,
  and `--no-track`.
- **"Merged" needs a moved branch.** Git's ancestry alone also says a fresh
  branch is merged; the chip and rail say *yhdistetty* only when the reflog
  shows the branch moved since creation and nothing is uncommitted. A
  repository with reflogs off never shows it.
- **Branch name** `wt/<first words of the first message>` (ASCII-folded,
  ≤ 40 chars, `agentti` when nothing remains); suffix `-2…` when taken.
- **Hooks off** for `git worktree add`, like the daemon's other Git writes;
  a slow post-checkout hook would exceed the 25 s bound.
- **Creation shares the `~/src` writer lock**, so it is refused
  (`workspace_busy`) while a clone job runs.
- **A removed worktree's conversations disappear** from the lists (no binding
  store; the path rule finds nothing). Pi's history remains.
- **Linked worktrees directly under `~/src`** stay workspaces of their own, as
  before; only nested ones are places.
- **Taskfleet-owned worktrees are not places**, so their worker sessions are
  not listed twice. When Taskfleet cannot be read they are listed as places
  for that snapshot.
- **Default model refused**: a worktree agent starts with the default anyway
  (no model dialog before the first message); Pi's own start problem then
  shows in the conversation.
