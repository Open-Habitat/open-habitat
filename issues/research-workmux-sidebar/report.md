# Research: the workmux sidebar, and what Open Habitat's sidebar can take from it

Sources: `github.com/raine/workmux` at commit
`23c09d88a1bce1b63c2d894439bb79915dd71901` (2026-10-25), cloned read-only.
Paths below without a prefix are in that tree. The binary installed on Birch
is `workmux 0.1.277` (`~/.local/bin/workmux`); its config and state were
read, not changed. Open Habitat paths are at `744cc3a5`.

## 1. What workmux has

workmux has two agent overviews over the same state.

- **Sidebar** (`src/command/sidebar/`, about 16 000 lines of Rust). It is a
  narrow pane pinned to the left or top edge of every tmux window and stays
  visible while you work. Docs: `docs/src/content/docs/guide/sidebar/index.mdx`,
  `…/sidebar/customization.md`, `…/reference/commands/sidebar.md`.
- **Dashboard** (`src/command/dashboard/`). A full-screen TUI opened on
  demand as a tmux popup. It has an Agents tab (table with a live terminal
  preview, diff view and input mode) and a Worktrees tab (branch, PR, checks,
  sweep of merged worktrees). Docs: `…/guide/dashboard/index.mdx`.

This report is about the sidebar. The dashboard's ideas are in §4 where they
apply.

### 1.1 Architecture

`src/command/sidebar/mod.rs:1-19` gives the module map. One headless
**daemon** per tmux server (`daemon.rs`) observes and publishes. Each tmux
window runs a render-only **client** (`_sidebar-run`, `client.rs`,
`runtime.rs`, `ui.rs`) that receives snapshots over a Unix socket
(`daemon.rs:29-37`, `$TMPDIR/workmux-sidebar-<fnv>.sock`).

- **Observation.** One batched tmux query every 2 s
  (`daemon.rs:2127 OBSERVATION_INTERVAL`), or at once on `SIGUSR1`. tmux
  hooks (`after-select-window`, `client-session-changed`, `after-kill-pane`)
  and the status-acknowledgement hook send that signal (`hooks.rs`,
  `multiplexer/tmux.rs:1642`). Agent records come from a file cache that
  skips unchanged JSON by inode, mtime and ctime (`state/store.rs:37-57`).
- **Background workers.** Git status per worktree uses a notify watcher with
  a 2 s fallback poll (`daemon.rs:1516`). GitHub PR and check summaries are
  also collected in the background. Both feed `git_statuses`, `pr_statuses`
  and `check_statuses` in the snapshot.
- **Snapshot** (`snapshot.rs:30-83`). The daemon decides ordering,
  grouping, staleness, interrupted panes, sleeping panes and expanded groups,
  and publishes them, so every client and the `next/prev/jump` hotkeys agree
  on the same list (`snapshot.rs:205-215`, `snapshot.rs:268-279`).
- **Clients.** The main thread blocks on a channel and wakes only for a
  snapshot or a spinner tick. Inactive windows skip rendering. The docs give
  about 15 MB per client and 16 MB for the daemon, with idle CPU near zero.
- **Layout.** A parser for tmux's `#{window_layout}` string scales the
  content subtree when the sidebar is inserted, so existing splits keep
  their proportions (`layout_tree.rs`).

### 1.2 How it learns agent status

Status comes from **agent hooks**, not from scraping.

- Each agent CLI gets a hook or extension that calls
  `workmux set-window-status working|waiting|done|clear` and
  `workmux register-agent` (`src/command/set_window_status.rs`,
  `src/agent_setup/*.rs`). The Pi extension is
  `resources/pi/extensions/workmux-status.ts`. It reports `working` on
  `agent_start`, `done` on `agent_settled` (an aborted turn stays working),
  serialises its writes so an old status cannot overwrite a newer one, and
  passes the latest prompt on stdin. Through `suba:activity` events it also
  keeps the parent marked working while pi-suba children are active. Pi has
  **no waiting state** in workmux (`…/guide/status-tracking.mdx`, table).
- The state lives in two places. One is a per-pane JSON file under
  `$XDG_STATE_HOME/workmux/agents/<backend>__<instance>__<pane>.json`
  (`state/store.rs:19-28`). On Birch, 11 such files exist for the Taskfleet
  tmux socket, with fields `status`, `status_ts`, `activity_ts`,
  `updated_ts`, `pane_title`, `workdir`, `session_name` and
  `agent_session_id`. The other is a set of tmux pane and window options
  (`@workmux_status`, `@workmux_pane_status`) that the status bar shows
  (`multiplexer/tmux.rs:1482-1530`).
- **"Done" and "waiting" clear when you look.** `set_status` arms a
  `pane-focus-in` hook. When the pane gains focus, the hook clears the icon
  and signals the daemon (`multiplexer/tmux.rs:1500-1530`, hook body at
  `:1642`). The acknowledgement lives in the tmux server, so every sidebar
  and status bar sees it, and it survives closing the sidebar.
- **Interruption detection.** If an agent is `working` but its pane text
  (last 5 lines, ANSI stripped, hashed) and its `updated_ts` have not changed
  for 10 s, it counts as interrupted. It then shows no icon and no timer and
  sinks in priority order. New output or a new RPC clears it
  (`daemon.rs:1941-2060`, `InactivityTracker::new(Duration::from_secs(10))`
  at `:2269`). This covers Ctrl+C, which no hook reports.
- **Staleness** (`agent_staleness.rs:6-31`). An agent is stale when it is
  sleeping, or when it has no working, waiting or done status and its
  activity is older than `stale_after` (default 1 h). Done stays actionable
  until it is acknowledged.

### 1.3 What a row shows

A row is a template over tokens (`customization.md`, token table;
`template/context.rs`). The defaults:

- tiles: `{primary} {pane_suffix} {fill} {elapsed}` /
  `{secondary} {fill} {git_stats}` / `{pane_title} {fill} {pr_number} {pr_checks}`
- compact: `{status_icon} {primary} {pane_suffix} {fill} {elapsed}`
- grouped tiles drop the project, because the header already says it:
  `{primary} … {pr_number} {pr_checks} {elapsed}` / `{pane_title} {fill} {git_stats}`

The useful tokens are the status icon (spinner, waiting, done, sleeping),
the worktree and project, `{elapsed}` (time since the last status change),
`{git_stats}` (committed `+1278 -400`, then uncommitted `+21`; the token
drops parts when space runs out), branch, ahead and behind, dirty,
conflict, `{pr_number}`, `{pr_checks}` with counts, `{pane_title}` (the
agent's own task title), `{prompt}` (the latest prompt), and `{jump_key}`
(`M-1`…`M-9`). In tile mode a coloured stripe on the left edge follows the
status, and stale tiles are dimmed (`ui.rs:1398-1510`).

### 1.4 States and list structure

- **Statuses:** working (spinner), waiting (💬), done (✅), none. Two derived
  states are interrupted (no icon, no timer) and stale (dimmed). Sleeping
  (💤) is set by the person with `z`, is dimmed, and sinks to the bottom.
- **Ordering** (`snapshot.rs:163-262`):
  - `recency`: the newest status change first.
  - `priority`: waiting, done, working, unknown, stale or interrupted, then
    sleeping. Recency breaks ties.
  - `window`: stable tmux order, "which keeps rows still while agents work".
- **Grouping** (`group_by: project|session`). Sections are alphabetical and
  keep their place, so a row moves only within its group. Headers count
  their agents and stick to the top while you scroll. Inside a group, stale
  agents form a tail folded behind one row ("N stale"). A group that is all
  stale becomes one toggle row, and such groups sink below a `STALE` rule
  (`snapshot.rs:186-215`). A folded group still shows the agent of the
  window the sidebar sits in: "the sidebar never hides where you are". Fold
  state is shared by all sidebar panes through tmux.
- **Empty and overflow.** "No agents running" and "No matching agents"
  (`ui.rs:1791`). In tiles, a muted `↓ N more` footer counts only the agents
  below the viewport (`ui.rs:1679-1700`).
- **Views and filters.** A session filter (`f`). Named views by session or
  project directory, where each window shows the view matching its own
  agent, with an "Other" catch-all (`view.rs`).
- **Positions.** A left sidebar (tiles or compact, toggled with `v`), or a
  horizontal top bar with one fixed-width chip per agent.

### 1.5 Keyboard and pointer

Inside the sidebar: `j/k`, `g/G`, `Enter` (focus the pane, or with
`enter_action: select` show it while focus stays in the sidebar), `o`, `v`,
`t` (grouping), `h/l/s/S` (folds), `z` (sleep), `f`, `V`, `?`, `q`. From
any pane: `workmux sidebar next|prev|jump N`, typically bound to Alt+j,
Alt+k and Alt+1…9. These follow exactly the order the sidebar shows, and in
a grouped list they skip stale agents, so "what Alt+1 reaches does not
change with the number of idle agents above it". `workmux last-done`
(`src/command/last_done.rs:6-60`) jumps to the most recent done or waiting
agent, and pressing it again cycles to older ones. `workmux last-agent`
toggles between the two most recent agents. Mouse: click a tile to jump,
scroll to move.

## 2. What Open Habitat has

The sidebar is `WorkspaceRail` with `NowSections`
(`web/src/components/Navigation.tsx:677-752`). It has three parts.

- **Sinun vuorosi**: conversations whose agent asks something, or that have
  a new reply the person has not seen.
- **Käynnissä**: other live conversations, which are working, waiting for a
  message, or waiting for background work (a process or a worker).
- The **workspaces** from `~/src` in alphabetical order, each with one hint
  mark (attention count, working, background or waiting).

The rows are built in `web/src/app/railNow.ts:35-200`. A row has two lines:
the title, then `workspace · state · what it waits for`. The status mark
leads (`agentMark`, `Navigation.tsx:515-548`): `●` new, `?` question, `◌`
working, `○` waiting, `◉` background, `✓` closed, `…` pending. A worker is
its own row, never nested under its parent (`docs/product.md`, "Työhön
palaaminen ja navigointi"). A parent whose worker works carries the
branch mark (`SpinoffWorkingMark`). On the narrow desktop rail the rows
become workspace initials with marks (`NowDot`). On the phone the rail is
a drawer, and the menu button carries a count.

The Workers panel (`web/src/components/BackgroundStrip.tsx`, Rivi
direction) sits above the composer. It lists the conversation's own
Taskfleet runs from `serveSpinoffs` (`internal/daemon/spinoffs_linux.go`):
two-line rows with state in words.

Status comes from Pi itself. The per-user daemon runs browser Pi sessions
over RPC and publishes `activity`, `run_active`, `pending_question`,
`waiting_on` and `spinoffs_working` in the snapshot
(`contracts/v1/snapshot.schema.json:540-640`). It reaches the browser as a
snapshot and an event stream. **New reply** (`attention: "new"`) is
**tab-local memory** (`web/src/app/conversationStore.ts:95-135`). A reply
is marked new only if it arrives while this tab is open, and it is marked
seen when the conversation is visible. Another device or a reload does not
see the mark.

## 3. Comparison

| Concern | workmux | Open Habitat today |
| --- | --- | --- |
| Source of status | Agent hooks write a per-pane file; tmux options | Pi RPC through the per-user daemon; native session files |
| "Needs you" | waiting (not for Pi) + done, cleared on pane focus, **shared across clients** | Sinun vuorosi: question (host) + new reply (**tab-local**) |
| Ordering | recency, priority or stable window order, configurable | Two-way split (yours / running), then catalog order; "the host knows no last-activity time" (`railNow.ts:31-34`) |
| Time on row | `{elapsed}` since last status change | `relativeTime` exists in `AgentNavModel`, but `railNow` never fills it |
| Many agents | Group by project, fold stale per group, sink dormant groups, `↓ N more` | One flat Käynnissä list; ten workers mean ten rows above the workspaces |
| Work facts on row | git `+/-`, dirty, ahead/behind, PR number, checks | Branch, dirty count and ahead/behind exist for workspaces and worktrees (`gitSummary`), but none are shown on rail rows; no PR facts |
| Task description | `pane_title` (agent's own), `{prompt}` | Conversation title (generated or first message) |
| Stuck agent | Output hash unchanged 10 s → interrupted | Pi reports its own turn state; process presence and staleness are separate facts |
| Move to the next one | `last-done` cycle, Alt+j/k, Alt+1…9 in list order | Click a row; no keyboard route, no "next" |
| Phone or narrow | Top bar of chips (horizontal mode) | Drawer behind the menu button; narrow desktop rail of initials |
| Person's own deprioritising | `z` sleep, view-local | None |

## 4. Ideas for Open Habitat, ranked

Each idea is judged against the product (`docs/product.md`) and the root
`AGENTS.md`. Unix users are the boundary. Native tools keep their own truth.
There are no parallel stores without a concrete need.

1. **Fold a long Käynnissä list by workspace, with quiet rows folded**
   (workmux `group_by: project` + `collapse_stale`). *Why it fits:* Jari runs
   about ten workers per stint in one repository. Each is its own row (a
   decided rule), so Käynnissä pushes the workspaces off screen, and the
   rail stops answering "what is going on now" at a glance. A header per
   workspace with counts keeps the rows where they are (workmux: "a row only
   ever moves within its own group"). The rule that workers stay their own
   rows still holds, because they are grouped by place, not under their
   parent. *Host facts:* none new. `workspace_id` and activity are in the
   snapshot. What counts as "quiet" (waiting for a message, idle for some
   time) needs the timestamp from idea 2. **Prototyped:** round
   `kaynnissa-ryhmat`.
2. **Time since the last change on every row** (`{elapsed}`). *Why it
   fits:* "Kysyy sinulta · 2 h" and "Työskentelee · 40 s" answer different
   questions. A row that has worked for an hour reads differently from one
   that just started. *Host fact needed:* a native `activity_since`
   timestamp per agent. Two sources are possible: the timestamp of the last
   entry in the Pi session file, which is the native record, or the time
   the daemon observed the transition, which is lost on restart. The first
   fits the "no parallel store" rule. Shown in both prototypes. An
   implementation needs this added to the snapshot contract.
3. **Move to the next conversation that needs you** (workmux `last-done`,
   `next/prev/jump N`). *Why it fits:* the product's return flow is "what
   waits for me". Today each step is: open the rail (on the phone, the
   drawer), find the row, click. A "Seuraava" control and Alt+↓/↑ /
   Alt+1…9 follow exactly the order the rail shows. On the phone, a strip of
   chips (workmux top bar) lets you switch without the drawer. *Host facts:*
   none for the cycle in rail order. "Most recent first" needs idea 2's
   timestamp. **Prototyped:** round `seuraava`.
4. **Seen-ness that holds across devices and reloads** (workmux clears done
   on focus in the tmux server, so all clients agree). *Why it fits:* a
   reply read on the phone stays "new" on the desktop, and a reload forgets
   every "new". Both are real faults of the "Sinun vuorosi" promise. *Host
   fact needed:* when the person last viewed each conversation, kept by the
   daemon as the user, in the user's own state. That is a new small store
   with no native equivalent, because Pi has no read marker. It needs Jari's
   decision (see `result.md`). The UI barely changes, so it is not
   prototyped; it is proposed as its own decision.
5. **Work facts on worker and worktree rows** (`{git_stats}`, PR, checks).
   *Why it fits:* the row says whether a worker has produced anything
   before you open it. *Host facts:* `gitSummary` (dirty count,
   ahead/behind) already exists for worktree places. Taskfleet-owned
   worktrees are left out (`snapshot.schema.json:334`), so worker rows would
   need the spinoff's worktree summary. PR and checks need the person's own
   `gh` (native credentials). Proposed as a later round, together with how
   much the Workers panel already says.
6. **Stable order as an explicit rule.** workmux's `window` sort exists
   because rows that jump are hard to hit. Habitat already keeps catalog
   order (`railNow.ts:31-34`). If idea 2 lands, do not start sorting
   Käynnissä by recency; keep recency to "Seuraava". No work, a guard.
7. **"↓ N lisää" for rows below the fold.** It is cheap and fits the phone,
   where the drawer's Sinun vuorosi can be longer than the screen. It is
   in every direction of round 1.
8. **Sleep or mute a conversation** (`z`). This would need view-local
   state that disagrees with the host. Habitat's archive already says "not
   now" natively. Not recommended.
9. **Interruption detection from output.** Not needed. Pi reports its own
   turn state over RPC, which is better evidence than a hash of terminal
   text. The lesson that applies is workmux's honesty: an interrupted agent
   shows no timer rather than a growing one. Habitat's `unknown` and stale
   marks already follow this.
10. **Reading workmux's own state files** (`~/.local/state/workmux/agents`)
    to show the status of terminal agents Habitat cannot observe (for
    example Claude Code in tmux). It fits "reuse native components", but the
    file format is workmux's private one with no contract, and the Taskfleet
    workers it covers are already observed as spinoffs. Not recommended now.

## 5. What not to copy

- **A template DSL for rows.** workmux is a power-user terminal tool. Habitat
  is designed with Jari and a designer, so one decided row anatomy fits it
  better.
- **One sidebar process per window.** This exists only because tmux has no
  persistent pane. The browser has one rail.
- **Polling tmux every 2 s.** Habitat's daemon has native events from Pi.
