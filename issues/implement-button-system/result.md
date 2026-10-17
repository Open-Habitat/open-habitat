# Result: the button system (Rooli ratkaisee)

## What changed

**One primitive, sized by role.** `ControlButton` in
`web/src/components/ControlElements.tsx` takes a required
`size: "page" | "row" | "inline"`; the old `compact`/`micro`/default sizes are
gone, so the type checker made every call site (about 290) pick a role. The
sizes live as tokens in `design-system/tokens/spacing.css`
(`--ah-control-{page,row,inline}` with font, padding, icon and gap):

| Role | Use | Desktop | Phone (≤ 800 px) | Text | Icon |
| --- | --- | --- | --- | --- | --- |
| page | screen's main action: onboarding, confirmations, Lähetä | 44 | 44 | 14.5 | 18 |
| row | action in a card or list row, top-bar icons, rail header | 32 | 40 | 13 (14) | 16 |
| inline | pills, segments, controls inside the composer, strip, tool output, rail rows | 26 | 32 | 12 | 14 |

An icon-only button (an icon or a lone symbol such as ×) is a square of the
role height without needing `presentation="icon"`.

**Segments and pills are the primitive.** New `Segmented` (one fieldset of
`ControlButton presentation="segment"`) replaces the bespoke `.s-seg`,
`.md-seg`, `.ah-composer-modes`, account-menu theme and work-choice CSS:
Teema and Agentin työ (settings and account menu), ajattelutaso, the Pi
provider choice, Ohjaa/Työn jälkeen and the clone dialog's source choice.
`presentation="pill"` draws the background-strip pills, the model chip in the
composer and top bar, the Git chip and Näytä työ. A native `<summary>` or an
inert placeholder that must look like the primitive uses
`controlClassName()`.

**Native disclosures** without their own class (Valmiit, Arkisto, tool
details, older models, …) show the rail's chevron instead of the browser ▶.

**Focus rule** (tokens + `design.md` › Painikkeet): ring 2 px at a 1 px
offset (was 2 px), so it takes `--ah-focus-room` = 3 px. Separate neighbours
keep `--ah-control-gap` (6 px) between them, so rings meet but never cover
each other (workspace icon row, phone top bar, rail workspace row, clone
dialog footer); touching segments draw the ring inside
(`--ah-focus-inset`); focusable controls carry
`scroll-margin: var(--ah-focus-room)` so keyboard scrolling stops short of a
container's edge. A simple rule was enough, so no focus prototype issue was
filed.

**Overrides removed.** The view rules that set height, width, padding, font
or icon size on the primitive are gone from `components.css`,
`WorkspacePage.css`, `HomeWorkspaces.css`, `BackgroundStrip.css`,
`ModelPicker.css`, `Settings.css`, `ProcessTray.css` and `DeviceLink.css`
(topbar icons, composer send and Stop, recap close, rail add/more/toggle and
section head, workspace icon row, home archive and primary, queue link, work
choice, mobile close and toolbar, Git chip, `+` font size, phone 40 px icon
row, md-btn/md-pill/set-chip geometry, strip clear/fold, …). The tokens
`--ah-composer-stop-size` and `--ah-topbar-icon-size` are removed. What
remains in view CSS is layout (margins, position, width 100 %) and colour.

**Pre-existing defect fixed on the way:** React Aria's `Button` drops `title`,
so no `ControlButton` tooltip ever reached the DOM (including the reasons a
control is disabled, e.g. "Työtilaa ei voi poistaa juuri nyt"). The primitive
now sets it on the element. The `+` on the workspace page and rail is the new
`plus` icon instead of a 22 px text glyph.

## Evidence

`evidence/` holds paired synthetic-lab captures (`before-*` from the base
commit, `after-*` from this tree; screenshot + static HTML) of Laitteet, Tili,
Ulkoasu, the workspace page, the conversation's lower area and the trash
dialog, each light/dark × desktop (1440) / phone (390), made by
`web/lab/capture-button-system.mjs`. Focus crops (`*-focus-*.png`, keyboard
`:focus-visible` via `focus({focusVisible:true})`): packed rows
(workspace icon row, theme segments, strip pills, dialog buttons) and the first
control at a scrolling container's top edge (rail list, strip panel, settings
main). Before: rings overlapped neighbours in the icon row and pills, the
theme segment wrapped on desktop. After: every ring whole and separate.

Size check: `*-sizes.json` lists every visible primitive with its role and
measured height. After: all 368 role-tagged buttons across the 24 captures
match the table (page 16, row 156, inline 196, 0 mismatches). Desktop heights
before: 26, 28, 30, 32, 34, 36, 44; after 26, 32, 44 (36 remains only on the
settings navigation rows, which are not buttons).

Limits: synthetic lab only (production bundle, invented homes, fake Pi,
Chromium). The trash dialog in the lab is the "cannot delete now" variant
(taskfleet unreadable), not the move-to-trash confirmation; both use the same
page-size footer. Hover/pressed were not captured.

## Checks

- `./scripts/test-focused.sh --area web`: pass (209 unit, 154 component).
- Browser suite (`--area browser`, all specs, final tree): 231 passed,
  2 skipped, 2 failed: the known `native key add` (fails identically on the
  base commit) and `changed snapshot identity discards late previous status`
  under eight-worker load (passes alone). An earlier run's theme failures
  (the title moved from a wrapper span to the button) were fixed in the spec.
- Lab suite (final tree): 44 passed, 1 failed: the known `expired combined
  cursor`. Two specs that hard-coded old sizes were updated (Stop 30 → 26;
  workspace icons ≥ 40 at 900 px → 32 desktop / 40 phone). `recap is
  separate…` fails under parallel load on this tree and on the base commit
  alike in a two-spec run, and passes alone and in the full run.
- Review: pure styling and primitive change (no session, contract, daemon or
  process change), so one focused self-review of the diff with the paired
  screenshots; it found the lost model-chip border on the phone top bar, the
  muted toolbar menu icon and the 44 px mobile toolbar override, all fixed
  before the final captures.

## Decisions for later review

- **Send is 44 and square.** The composer's Lähetä was a 36 px circle; as the
  screen's main action it is now a 44 px page button with the 8 px radius,
  aligned with the 44 px editor. The prototype drew it at 40.
- **Icon-only buttons are role-height squares** (44/32/26), not the
  prototype's slightly smaller 40/30 for page and row icons: one scale.
- **One icon size per role** (18/16/14); the prototype used 20/16/15 for
  icon-only buttons.
- **Rail row controls are inline** (workspace chevron, +, …, Valmiit and
  Arkistoidut toggles: 26, phone 32); the rail header (Päivitä, Uusi työtila,
  collapse) is row. Top-bar icons are row (32, phone 40).
- **Stop is a quiet inline icon** as in the prototype, no longer an
  ink-filled 30 px circle.
- **Home "Uusi työtila" is row** (section header), not page.
- **Navigation rows stay their own kind:** settings section rows, strip and
  spinoff list rows, menu items and tabs are not resized. The conversation's
  disclosure lines (turn head "PI · …", Ajattelu, the bash fold line) keep
  their text-line look through their existing view rules; they could move to
  `DisclosureButton` when disclosures get their own pass.
- **Account-menu theme** is an icon-only `Segmented` (titles on the buttons).
- On the phone the narrower model chip now fits beside the conversation
  title, which therefore truncates sooner than before.
- The global ring offset moved from 2 px to 1 px for every focusable, not only
  buttons, so inputs and links share the rule.
