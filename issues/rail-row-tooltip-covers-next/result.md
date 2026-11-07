# Result

Quick help in the rail now opens beside the control, toward the page
(React Aria placement `end`, flipping only where there is no room), instead
of below it. A conversation row's small buttons (archive, rename, raise and
lower) therefore never cover the next row, and the same holds for the
workspace rows' buttons and the rail's other icon buttons. The placement is
a context in `web/src/components/QuickTooltip.tsx` (`TooltipSide`) that
the rail (`Navigation.tsx`) provides; everything outside the rail keeps help
below.

The row's own description is a native `title` on the row; over its buttons
it would also open below the pointer after a second, on the next row. The
buttons' slot now carries an empty `title`, so only the button's own help
shows there.

Evidence: `web/tests/rail-archive.spec.ts` hovers the archive button and
checks that its help starts right of the row, is drawn on top (not clipped by
the rail) and that the row's native title is suppressed over the buttons.

## Decisions for later review

1. **Beside, not dropped.** The help stays and moves aside. Alternative:
   no help on the rail rows' small buttons. The disabled archive explains
   its refusal only through this help, so dropping it would lose the reason.
2. **The whole rail, not only conversation rows.** Every quick tooltip in the
   rail opens beside its control. Alternative: only the conversation rows.
   The workspace rows have the same stacked small buttons and the same
   problem, and one rule for the rail is easier to keep.
