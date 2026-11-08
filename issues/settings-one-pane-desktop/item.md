---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Settings opens as a full-width bare list at a desktop window width

## Description

Jari 8.11.2026 14:38, test server pilot.637, light theme, window about
1030 CSS px wide (`evidence/jari-2026-11-08-settings.png`): "Asetukset on
täysin rikki". Settings opens as one pane: the section list stretched across
the whole window (search box and *Tili* row ~1900 px wide at 2x), no section
content, nothing else on the page.

Regression from this round's settings changes (`settings-breakpoint-jump`
24b81a39a, `main-suite-red-r68` 320dd0ca4): the one-pane fold still applies
at `max-width: 1050px` in `web/src/components/Settings.css`, so an ordinary
laptop window gets the phone layout, and in that layout the list is not
width-limited. Before this round the same width showed two panes.

Fix: the settings one-pane (list/detail) layout belongs to phone widths only
(the app's 800 px breakpoint); at desktop widths Settings shows the section
list and the selected section (Tili by default) side by side, hiding the
workspace rail as needed (the 1051–1400 rule already does this). Keep the
property that narrowing the window changes each row's layout at most once
(the width-sweep spec). In the one-pane layout the list must not stretch
absurdly: cap its width or keep the phone styling. Opening `/settings` at
any desktop width must show a section's content, not only the list.

## Acceptance Criteria

- [ ] At 801–1400 px Settings shows the list and Tili side by side; at
      ≤800 px the phone list/detail, list not stretched.
- [ ] Width-sweep and settings specs green; screenshots at 900, 1030, 1280,
      390, light and dark.
