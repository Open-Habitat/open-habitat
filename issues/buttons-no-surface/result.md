# Result

**Cause.** The shared control style is `ControlButton` (`Controls.module.css` over `interactive.module.css`). Secondary buttons, such as "Poista ylläpitäjärooli" and "Raja…", were filled with `--ah-surface`, which is the same colour as the settings cards they sit on. Their `--ah-line-strong` border never rendered, because the `.button` border shorthand wins over the surface's `border-color`. Quiet buttons with a text label, such as "Päivitä Git-tila", "Poista avain…" and "Palauta", had no fill at all. Both kinds read as bold text.

**Fix.**

- **New tokens.** `design-system/tokens/colors.css` gains `--ah-control`, `--ah-control-hover` and `--ah-control-press`, each a tint of the ink: 6/10/14 % in light and 9/13/17 % in dark. A tint reads on the page background and on a card alike. It also adds `--ah-control-line`, which this fix does not use yet; it is there for when the border is fixed (see the decisions below).
- **Text buttons get the fill.** `ControlButton` marks a button labelled in words, directly or beside an icon, with `styles.text` (and the stable `ah-button-text` class). A text button in the secondary or quiet variant then gets the control fill and its hover and press steps.
- **Some controls stay as they were.** Icon-only buttons, lone-symbol labels such as × or ⧉, and the `back`/`account`/`icon` presentations keep their earlier look, so the rail, toolbars and headers do not change.
- **Admin table spacing.** The settings table spaces its row actions, which now have surfaces and wrap.

## Audit

`capture.mjs` captures home, a plain workspace, a Git workspace, a conversation and all eight settings sections (Tili, Agentit, Yhteydet, Ulkoasu, Tallennustila, Palvelin, Käyttäjät, Levytila). Each is captured on desktop and phone, in light and dark, before and after: `before-*.png` and `after-*.{png,html}`, 48 pairs. Every text button on those screens now has a visible surface.

Seen in the pairs:

- **Settings.** In Käyttäjät, "Poista/Anna ylläpitäjärooli" and "Raja…". In Tili, "Kirjaudu ulos…" and "Muokkaa Git-identiteettiä". In Yhteydet, "Kirjaudu Pi:hin uudelleen" and "Tarkista tunnukset".
- **Git workspace.** The Git status chip.
- **Archived group.** "Palauta" in the archived group.

A component test (`ControlElements.test.tsx`) pins the rule: word labels are text buttons, while icon-only, lone-symbol and back controls are not.

## Decisions for later review

- **Fill, not border.** The visible cue is a fill. Fixing the border shorthand would change every secondary icon button across the app at once, so it is left for a separate decision; `--ah-control-line` is ready for it.
- **"Takaisin" stays quiet.** The settings "Takaisin" (the `back` presentation) is navigation and stays quiet.
- **Status pills are unchanged.** Status pills such as "Tilaa ei tiedetä" are not buttons and are unchanged.
- **Native buttons outside `ControlButton`.** About a dozen native `<button>`s are outside `ControlButton`, for example the settings section list and the background strip pills. They have their own designed surfaces and were not changed.
