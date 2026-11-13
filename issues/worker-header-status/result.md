# Result: worker-header-status

Direction 1 "Otsikkorivillä" is in production. `WorkerView` fills `AgentHeader`'s `gitStatus`,
`contextIndicator` and `modelPicker` slots:

- **Git**: production `GitStatusChip` + `GitStatusDetails` for the worker's own worktree, read through the
  existing `/api/v1/workspaces/git` route by the worktree's place ID. Without a registered worktree, the chip
  shows spinoff-work's counts against the source branch, and the layer says why no file list exists.
  Fetching is disabled in the worker view (it is read-only).
- **PR**: a pill beside Git (link to GitHub, state, checks in the tooltip). On a phone it is hidden on the
  title row, as in the round, and the worker's details carry the PR summary and a copyable address.
- **Context**: production `ContextRing` from the Pi worker's own session (`context_tokens`, window from the
  Pi catalog). It opens the worker's details.
- **Model**: a read-only button (model · thinking level in the tooltip) that opens the worker's details.
  It is never a picker.
- **Unknown**: the same control with "?" and a sentence giving the cause (reading, not found, landed,
  Claude Code usage not read, session not found or not read, nothing reported yet). On a phone the facts
  line shows "?".
- The work-sentence line is gone. The band keeps worker, parent link, harness · profile and Ask. The phone
  title row no longer indents beside the floating menu button.

## Decisions for later review

- **New host data: `git_workspace` on the selected run** (`contracts/v1/spinoffs.schema.json`). The daemon
  resolves the worker's worktree to the opaque ID of a Git workspace or worktree place, using Git's own
  registry (`workerGitWorkspace`). The browser then uses the existing workspace Git route, which resolves
  the ID again on every read. I chose this over a new run-ID-keyed Git route: it reuses the route,
  validation and base logic a conversation's chip already has. No authority moves, and nothing is stored.
  It costs one more `Discover` plus a registry read per selected-run poll; the terminal pointer already
  does the same work.
- **Freshness**: the worktree is read when the view opens, when the layer opens, and when spinoff-work's
  30 s counts for the worker change. That is the worker's equivalent of a conversation's snapshot
  observation, and it is never polled on its own.
- **Claude Code context stays "?"** with its own sentence, as the round decided (out of scope). Pi context
  and both harnesses' model names need no host change.
- **No worktree but a kept branch** (an ended run): the chip comes from spinoff-work counts; uncommitted
  is 0 because there is no worktree.

## Validation

- Go: `scripts/test-focused.sh --area go --go-package ./internal/daemon` passed (new
  `TestWorkerGitWorkspaceIsTheWorktreesPlace`).
- Contracts: `--area contracts` clean.
- Web: `--area web` passed, 211 files / 1609 tests (new `WorkerHeader.test.tsx`).
- Browser (`OH_BROWSER_WORKERS=2`): worker-view, worker-panel, spinoffs, worker-row-sentence, context-ring
  and lab-phone-header all passed, 13 tests. The new worker-view case drives a real Git worktree through
  the daemon.
- Review: `/llm-review` (finder only): no daemon or contract findings; six browser should-fix findings,
  all fixed.

Live check: verified through the synthetic host (real gateway, daemon, Git and fake Taskfleet), not on a
live installation. Screenshots (1440/390, light/dark, scale 2) are in
`~/src/open-habitat-dev/worker-results/01m7aq7s0ga4sjh86nnp4jd65x/` (not committed).
