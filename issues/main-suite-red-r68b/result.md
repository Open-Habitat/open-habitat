# Result

All 16 listed cases pass when run by name on top of `e8e7ef37f` (first on `8ddcb319f`, rerun after rebasing) (Birch,
`OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=12300`, umask 077). The logs the issue
names were not on Birch, so each failure was reproduced first, and the two
larger groups were bisected (`git bisect run` in a disposable detached
worktree) to the commit that turned them red.

## Causes per group

**Rail (Sinun vuorosi kept a read reply): spec change.** Bisected to
`c1cc86abc` (`graduate-three-experimental`), which made Raise / Ei nyt the
default. Since then a reply the person has seen stays in Sinun vuorosi as
*read* (ring ball, `data-turn="read"`) until they answer or say Ei nyt. Specs
written for the old off path expected an opened or answered-in-sight reply to
leave Sinun vuorosi or to rest in Hiljaiset. Some of them passed some of the
time because they could sample the short moment before the reply was marked
seen. Updated to the deliberate behaviour, with their intent kept:
`rail-turn-returns` (each turn returns as news, seen in one tab it is read in
the others, Ei nyt clears it everywhere), `rail-unread` (open by keyboard
makes it read and keeps the other one as news, then Ei nyt from each row
empties the list and the phone badge), `rail-running-after-done`,
`rail-icons-quiet:413`, `rail-now:90`, `spinoffs:387` and the lab
`lab-worktree-agent`. The intake `fiercely-unkempt-look` is the same cause.

**Bottom strip drawn empty: product regression.** `offer-cards-and-assets-list`
passed `assets={<AssetsControl …/>}` to `BackgroundStrip`, and a React element
is always truthy. As a result, every conversation without workers or
processes drew an empty `background-work` strip (an unnamed empty labelled
group above the field). `ConversationAssets` returning null did not help,
because the strip had already decided to draw. Fixed by making it a hook,
`useAssetsControl`, that returns null when the conversation has no views or
files. Fixes `process-tray:25` and `queued-send:171`.

**Status bell missing on Settings at 801–1400 px: product regression.**
Bisected to `320dd0ca4` (`main-suite-red-r68`), which lets the app rail
yield to Settings up to 1400 px instead of 1100 px. The bell lives in the
rail's head (and in the phone toolbar ≤800 px), so at ordinary desktop
widths Settings had no bell at all. This was already true at 801–1100 px
before that change. Settings now carries the bell beside its X exactly where
the rail is hidden. `status-bell`, `quota-pressure` and `ai-sign-in-window`
pass; `ai-sign-in-window:137` clicked the bell inside `workspace-navigation`
and now clicks the visible bell.

**`lab-sidebar-default`: spec change.** At the lab's default 1280 px width
the rail is hidden behind Settings (same `320dd0ca4`), so the rail's plus
the spec checks is not on screen. The spec now runs at 1440 px, where
Settings keeps the rail beside it.

**`browser-conversation:1494`**: passed without changes in every run (1 + 3
repeats); it was not reproduced, so no change.

## Decisions for later review

- Settings' own bell sits beside its X, shown only at 801–1400 px with a rail
  present; alternatives were showing the phone toolbar at those widths
  (its menu button would open a drawer that the desktop layout does not
  have) or keeping the rail, which reverses `320dd0ca4`'s deliberate layout.
  One bell per screen still holds (rail/toolbar bell elsewhere).
- Rail specs were changed to the Raise / Ei nyt default rather than the
  product, because `graduate-three-experimental` deliberately removed the
  off path and Explain mode says reading a reply does not dismiss it.

## Validation

- All 12 listed browser cases together, `--repeat-each=3`: 36 passed.
  Lab `lab-sidebar-default` + `lab-worktree-agent` `--repeat-each=3` with the
  lab config: 12 passed.
- Neighbouring specs touching the strip, bell, settings and rail (22 files,
  89 cases: agent-file-offers, named-workers, worker-panel, ended-worker-ask,
  cross-workspace-agents, worker-row-sentence, spinoffs, process-tray,
  queued-send, github-connection-warning, server-version-reload,
  settings-breakpoint, account-settings, rail-*, status-bell, quota-pressure,
  ai-sign-in-window, raise-to-your-turn): all passed after the `rail-now` fix.
- `./scripts/test-focused.sh --area web`: 193 files / 1448 tests passed.
- `generate-ui-reference.py --check`, `TestUISkillRestoresAllReferences`,
  `git diff --check` passed. Screenshot check of Settings at 900/1280/1440
  px with a danger bell (synthetic host): bell beside the X, one bell each.
- Review: focused self-review (web-only; no daemon, contract, session-state
  or authority change).
- After rebasing onto `e8e7ef37f` (with `send-during-restart-uncertain`):
  web 194 files / 1459 tests, the 12 browser cases `--repeat-each=2` (24
  passed) and both lab specs passed again; UI reference regenerated.

The untriaged intakes `fiercely-unkempt-look`,
`queued-send-stop-startup-background-control` and
`spinoffs-settled-quiet-rail-regression` record failures from these same
groups; intake items cannot move straight to `fixed`, so they are left for
the lane-or-close decision.
