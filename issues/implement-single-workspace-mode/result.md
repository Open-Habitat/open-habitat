# Result: single-workspace mode (Yläpalkissa)

## What changed

- **The mode is derived, never stored.** `App.tsx` reads it from the snapshot:
  when the listing is confirmed and exactly one workspace is visible, the frame
  has no sidebar. Hidden workspaces do not count. An unconfirmed listing keeps
  the sidebar, because the sidebar is where missing information is shown.
- **The top bar** (`components/SingleWorkspaceBar.*` and
  `app/SingleWorkspaceBarView.tsx`) takes the sidebar's place on desktop and on
  the phone. From left to right it has:
  - the workspace name, which leads home and is marked current there;
  - the workspace menu: Kopioi polku, Avaa GitHubissa, Muuta näyttönimeä…,
    Uusi worktree-agentti… (for a Git main checkout; it replaces the page
    icon row's button from `implement-worktree-agents`, which landed during
    this work), Lisää työtila… (opens `/workspaces/new`), and
    **Siirrä roskakoriin…**,
    always disabled with the reason "Tämä on ainoa työtilasi, joten sitä ei voi
    siirtää roskakoriin.";
  - the connection dot, which has a text label for screen readers;
  - Uusi keskustelu, shown as an icon only on the phone;
  - the account menu. The server name, version and connection have moved into
    this menu.
- **Home is the workspace page** (`WorkspacePage single`). It shows Keskustelut
  with a summary, the Git pill, Avoimet, Valmiit and worktree cleanup.
  Arkistoidut is at the end, and hidden workspaces can be restored from there.
  `/workspaces/<only id>` redirects to `/workspaces`. Conversations drop their
  workspace link (CSS), and on the phone their header loses the room it kept
  for the navigation button.
- **Transitions.** Every change across one visible workspace shows a notice, in
  either direction:
  - *Jäljellä on yksi työtila, joten näkymä keskittyy siihen.*
  - *Työtiloja on nyt kaksi, joten sivupalkki näyttää ne ryhminä.*
  - When a Trash move or a permanent deletion causes the change, the Trash
    notice carries the sentence instead of a second notice appearing.
  - The sidebar or the bar eases in over 220 ms, unless reduced motion is set.
  - The notice is cleared together with the person's state.
- **The daemon refuses the last workspace as well.** `delete_check` and
  `delete` add a `last_workspace` blocker when the target is the only visible
  workspace. The count follows the snapshot's rules: readable entries that are
  not hidden, without Taskfleet's worktree containers. A visibility file that
  cannot be read blocks with `unknown/workspaces`. The check runs under the
  deletion locks, so two concurrent deletions cannot both pass it.
- **Worktree cleanup has the same guard** (review fix). It applies to
  `worktree_remove` and `worktree_clean_merged` for a linked checkout directly
  in `~/src`, which is a workspace of its own. Both contracts and the browser
  texts carry the new blocker.
- **New browser-host fixture.** `/fixture/keep-workspaces?names=…` gives
  one-workspace and two-workspace homes.

## Evidence and its limits

- **Browser tests.** `web/tests/single-workspace-mode.spec.ts` (4 cases, host-backed synthetic) covers:
  - one workspace: bar, blocked Trash with its reason, account menu, redirect,
    the conversation's missing workspace link, phone layout, axe with no
    serious findings;
  - two → one → two through the real daemon Trash and its Palauta, with both
    notices;
  - a hidden workspace not counting, and restoring it from home;
  - a Git workspace's menu opening a new worktree agent.
- **Go tests.** `TestWorkspaceDeleteKeepsTheLastVisibleWorkspace` covers trash
  and permanent deletion, a hidden workspace, the transition from two to one,
  and an unreadable visibility file. `TestWorktreeRemovalKeepsTheLastVisibleWorkspace`
  fails with the guard disabled and passes with it.
- **Checks run on the final tree:**
  - `--area web`
  - `--area contracts`
  - `--area go --go-package ./internal/daemon`
  - browser specs: single-workspace-mode, workspace-archive,
    home-workspace-sections, shell-accessibility, lab-workspace-page,
    lab-workspace-trash, lab-worktree-cleanup, lab-sidebar-account,
    lab-sidebar-default, lab-git-status, lab-worktree-agent (after rebasing
    onto `implement-worktree-agents`, whose snapshot test was adjusted for the
    trash fixture's second workspace).
- **Full default browser suite: 240/244.** The new spec's one failure was a
  hover contrast problem and is fixed. Two other failures reproduce on the
  untouched base commit `b90aff09`, so this branch did not cause them:
  `account-settings.spec.ts:379` (native key add) and `github-stream.spec.ts:6`
  (slow clone stage). A third, `browser-conversation.spec.ts:2071`, was flaky:
  the whole spec passed (65/65) when rerun.
- **Screenshots.** `evidence/` pairs lab screenshots and inert HTML with
  prototype captures (`web/lab/capture-single-workspace.mjs`), in the same
  states on desktop and phone: to-single, home, menu, account, conversation,
  to-multi. This is synthetic lab evidence, not the live host.
- **Review.** One independent `/llm-review` was run (finder gpt-6-astra,
  verifier claude-fable-5-1), followed by `/assess-findings`. It produced 3
  confirmed findings, all fixed in `8be62658`: the worktree-cleanup bypass, the
  mode notice surviving logout, and the missing note on permanent deletion.
  No findings were dropped.

## Differences from the prototype

- Menu items have no icons, because the production `Menu` has none. On the
  phone they are taller, as touch rows.
- The bar's + and account buttons are 44 px touch targets on the phone. The
  prototype draws them at 36 px.
- Lisää työtila opens the existing `/workspaces/new` page rather than the
  prototype's short clone dialog. The prototype names the chooser as the
  `repon-valinta` round's subject.
- The new workspace is not briefly highlighted in the sidebar or on home after
  the change. The notice and the 220 ms ease-in carry the change.
- There is no Arkisto fold for archived conversations, because production
  does not have one on the workspace page yet.
- The multi-workspace home and sidebar are today's production views, as the
  prototype intended.

## Decisions for later review

- **Hidden workspaces do not count** (recommendation, question 2). Hiding all
  but one workspace enters single-workspace mode. Hidden workspaces are listed
  at the end of the single-workspace home, so they stay reachable without a
  sidebar.
- **A notice on every mode change** (recommendation, question 4). The change
  from zero to one workspace also has its own notice. The change from one to
  zero does not, because zero workspaces is the start view.
- **An unconfirmed listing keeps the sidebar** even if it shows one workspace,
  because it may be one of several.
- **Trash is shown disabled with its reason**, not removed from the menu. The
  daemon also refuses permanent deletion of the last visible workspace, and
  worktree cleanup of it.
- **The single-workspace menu has no Arkistoi (hide).** The prototype menu has
  none, and hiding the only workspace would empty the view.
- **Residual:** the worktree list still offers Poista for a direct `~/src`
  checkout that is the last visible workspace. The block arrives on the click,
  or in the bulk cleanup's kept list. This is rare, and showing it in the list
  would need the listing and removal tokens to agree on the blocker.
