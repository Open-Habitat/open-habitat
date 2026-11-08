---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Settings rows jump between stacked and side-by-side around the one-pane breakpoint

## Description

Jari 8.11.2026, test server pilot.627, Settings › Tili, light theme, resizing
the window (`evidence/jari-2026-11-08-{1,2,3}.png`):

1. Two panes, wider: rows are side by side, but the content column is so
   narrow that the descriptions wrap into tall thin columns.
2. Two panes, a few pixels narrower: a different form where every row stacks
   (description, then value, then buttons on their own lines).
3. Narrower still, one pane (*← Asetukset*): rows are side by side again and
   wide.

So within a few pixels the layout goes squeezed → stacked → wide. The row
layout must follow the width actually available to the content (container
query on the settings content rather than viewport), and the one-pane switch
must happen before the two-pane content gets too narrow for side-by-side
rows, so narrowing the window changes layout once, monotonically. Check every
settings section and Palvelimen ylläpito, not only Tili. Defect fix, no
prototype.

## Acceptance Criteria

- [x] Narrowing the window from 1600 to 390 px changes each settings row's
      layout at most once, never back to wider; checked with a width sweep in
      a browser spec across sections.
- [x] Screenshots at the old jump widths, light and dark.
