# Result: Hiljaiset, every other conversation as one flat list

The rail's conversation sections are now **Sinun vuorosi · Käynnissä ·
Hiljaiset**. Viimeisimmät and its count setting are gone: the contract field
`recent_count`, the daemon merge, the Ulkoasu row, its story, catalog and
search entry. Hiljaiset follows the accepted design (round 4 riff 1
*Ruudut*, round 5 riff 2 *Rengas*):

- Every listed, non-archived conversation that is neither the person's turn
  nor running, newest first (`changed_at`), as one flat list with no
  workspace headings. The person's own finished worktree conversations are
  included.
- The header's icon stack opens the icon-grid popover: order segments
  (Uusin · Työtila · Nimi) and workspace tiles (Kaikki plus each workspace
  with its count), closed by Valmis, Esc or a click outside. There is no foot
  text. With one workspace chosen, *Työtila* is not offered and the list is
  newest first. The stored order returns with Kaikki. When narrowing would
  hide the open conversation, its row stays last, marked as kept. By
  workspace, groups are separated by a hairline, not a heading. A
  non-default order shows its word beside the stack, and a narrowed choice
  tints the button.
- Order and workspace are account preferences (`quiet_sort`:
  `newest | workspace | name`, `quiet_workspace`: a `workspaceId` or `null`),
  merged by the daemon one change at a time. They follow the person to every
  device. The fold is per device (`localStorage` `nah:rail-quiet-folded`).
- Folded: the open conversation's row (if it is quiet), then one pill per
  workspace (icon and count). A pill opens the section narrowed to that
  workspace.
- The open row is ringed (`0 0 0 1.5px var(--ah-accent)` around the whole
  row, icon included) on a current-surface background. There is no edge
  stripe anywhere.
- The narrow dot rail beside the editor is unchanged and has no Hiljaiset.

## Evidence

Synthetic lab, device scale factor 2, AVIF and HTML side by side in
`evidence/` (made by `web/tests/rail-icons-quiet.spec.ts` with
`OH_VISUAL_CAPTURE=1`):

- `{desktop,phone}-{light,dark}-icons-{on,off}`: the open list with the
  ringed open row.
- `…-folded`: the same, folded (open row and pills).
- `desktop-light-menu`: the popover. `desktop-light-narrowed`: narrowed to
  one workspace with the open row kept last.

Tests:
- Browser: `rail-icons-quiet.spec.ts` (`@rail-quiet`, 4 cases: sections and
  exclusions in every layout with axe; menu order, narrowing, account
  follow-through to a second tab, kept row, ring without stripe, settings
  row gone; fold per device, pills, axe; idle stop and restart, then
  archive). Also passing: `rail-groups`, `rail-running-after-done`,
  `rail-interrupted-turn`, `settings-selectors`.
- Unit: `QuietSection.test.tsx`, `railNow.test.ts`, and the daemon's
  `account_preferences_linux_test.go`, including a file that still carries
  the retired `recent_count`.
- Contracts: `validate-contracts.py` with new negative cases.

Review: independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable
5.1) and `/assess-findings`. Three browser-state findings were confirmed and
fixed. A chosen workspace with nothing quiet no longer reads as stale, folded
pills wait while a preference write is pending, and same-named workspaces no
longer interleave. There were no findings in the daemon or the contract.

## Decisions for later review

1. **Finished worktree conversations are in Hiljaiset.** The alternative was
   to keep them on the workspace page only. Round 2 found that the
   exclusion only hid them, and "all" was Jari's word.
2. **The ring marks the open row in every rail section**, not only in
   Hiljaiset. The alternative was a ring in Hiljaiset and the old white row
   elsewhere. One emphasis for "this is open" is easier to learn than two.
3. **The folded pill of the open conversation's workspace is not marked**
   (the conductor's default for round 5's question). The ringed row above it
   is enough.
4. **Without workspace icons**, the header stack, tiles and pills show the
   workspace's initials on a neutral tile (as the narrow rail does). Rows
   carry the workspace name in mono before the age. The alternative was to
   hide the grid without icons. The grid is the accepted control, and the
   initials keep it usable.
5. **A preferences file that still has `recent_count` is read, and the key is
   dropped on the next save.** The repository's rule is no compatibility
   code. Without this tolerance, everyone who had touched the count (Jari on
   Birch and the test server) would lose all their account preferences,
   because the strict decoder rejects the file and every later write. The
   cost is one ignored field.
6. **A chosen workspace that is still listed but has nothing quiet stays
   chosen** (tile at 0, empty list apart from a kept open row). A workspace
   no longer listed (removed or hidden) reads as Kaikki. The alternative was
   to treat both as Kaikki, which made the list jump when that workspace's
   last quiet conversation started running.
7. **Choices are confirmed, not optimistic.** The segment and tile apply
   when the daemon confirms (one local round trip), and the controls wait
   meanwhile, as other account preferences do. Optimistic would feel faster
   but could show a choice that did not stick.
8. **No settings row for order and workspace.** The rail menu is the only
   place, and settings search has no entry for them. A settings row would
   repeat the menu.
9. **The English name is "Quiet"** (Quiet, Newest, Workspace, Name, All,
   Done).
10. **The narrowed count reads `n/total`** in the header (screen readers hear
    "n/total, total yhteensä"). The fold is shared by tabs of the same
    browser.
