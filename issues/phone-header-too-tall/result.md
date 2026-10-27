# Result

On a phone (≤ 800 px, the existing mobile breakpoint) the conversation header
is now two rows instead of five. In the synthetic lab at 390 and 360 px its
height drops from 191 px to 97 px.

- Row 1: the title (one line, shortened), the editor and terminal panel
  buttons and a chevron menu, beside the floating menu/home buttons.
- Row 2: activity, Git chip, context ring and model chip. The chip fills the
  space left over and shortens the model name, so the row never wraps.
- The menu (`conversation-menu`, the `Menu` primitive) holds the full title as
  its heading, then the workspace, *Luo uusi otsikko*, the archive action
  (*Arkistoi* / *Palauta näkyviin* / *Sulje*) and *Tiedot*. A blocked action
  shows its reason in the menu. Before this, the reason was only a tooltip,
  which a touch screen never shows.

Screenshots in `shots/` (DSF 2, made with `shoot.mjs` against `scripts/lab.sh`):
`before-390-{light,dark}`, `after-{390,360}-{light,dark}`, `after-390-light-menu`.

The cause was six contradictory `max-width: 800px` rule sets on
`.ah-agent-topline` (wrap, then nowrap, then wrap again, and the title forced
to `flex: 1 0 100%`) plus a 100 px left inset on the whole header. They are
replaced by one phone block. Only the title row keeps the inset.

`AgentHeader` now takes `archive` (the `ArchiveControls` props) instead of a
ready-made `archiveControl` node. `archiveAction()` is the single source of the
action, its label and its blocked reason for both the icon and the menu item.

## phone-composer-hidden-while-typing

In the lab, with the keyboard emulated as a smaller visual viewport
(`phone-composer-keyboard.spec.ts`, which still passes), the composer stays in
view both before and after this change. The tall header took ~190 px of an
iPhone's ~400 px visible height while the keyboard was open, which explains
the "only a strip of conversation" part. It does not by itself explain a
composer that is not visible at all; that points to Brave/iOS visual-viewport
handling and needs a check on the device with this build.

## Other observation

At a 1280 px window with the sidebar open, the desktop header (content column
~820 px) has no room left for the title: the chips and five icons take the
whole row and the title shrinks to nothing (seen in the lab with an unknown
model, whose chip is wide). This change does not touch desktop rules, so the
problem existed before it.

## Decisions for later review

- **Menu with labelled items instead of a disclosure of the same icons.** The
  icons are kept on desktop and hidden on a phone. On a phone the menu builds
  items from the same data (`archiveAction`, `titleAction`). Alternative:
  wrap the existing icon buttons in a phone-only popover. That has no labels
  and no visible blocked reasons on touch.
- **The panels stay on row 1 and the state on row 2.** As a result, keyboard
  focus order (title, state chips, panels, menu) differs from the visual
  order on a phone, where the panels sit on row 1 to the right of the title.
  The alternative orders either push the model chip out of row 2 at 360 px or
  move the panel buttons into the menu.
- **Breakpoint is the existing 800 px**, so tablets also get the two-row
  header and the menu.
- **The model name is shortened, not hidden**, on a phone (the old rule hid it
  in the fallback chip). The thinking level always shows.
- **In single-workspace mode the menu still lists the workspace**, although
  the top bar already names it. Kept for simplicity.
- `data-testid="conversation-model"` is added to the header's model chip
  (`ModelChip` now wraps the name in `.ah-set-model`) so the test can find it.

## Checks

- `./scripts/test-focused.sh --area web`: passed.
- Browser (touched/added only, `OH_PORT_BASE=5274` because another worker held
  4183): `lab-phone-header.spec.ts` (new, 390 and 360 px, axe light/dark),
  browser-conversation "phone archives directly", native-history "read-only
  control retains", lab-onboarding "long native title", lab-shell-header
  390px, single-workspace-mode top bar, phone-composer-keyboard,
  native-history narrow, lab-onboarding narrow navigation, control-states
  migrated rail, browser-conversation native strip: all passed.
