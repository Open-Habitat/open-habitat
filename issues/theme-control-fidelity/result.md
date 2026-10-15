# Result

The account popover now has the draft's `Teema` row with a three-icon segmented selector. Every icon is a named button with the same tooltip and pressed state; choosing a theme keeps the popover open, as in the draft.

## Evidence

- `draft-light.png` / `draft-dark.png`: read-only Etusivu prototype with account menu open and corresponding selection. `lab-light.{png,html}` / `lab-dark.{png,html}`: synthetic production lab, same menu states. The selector rectangles match the prototype exactly at native scale: draft x=329, y=672.39, 98×30; production x=171, y=763.81, 98×30 (different sidebar position); button offsets +2/+34/+66, each 30×26 in both. The surrounding drafts include different workspace fixture data.
- Focused browser `theme.spec.ts` passed (3/3); web static/unit/component suite passed (118 unit, 117 component). The account lab spec is recorded after retry.

## Decisions for later review

- Theme controls are actual buttons in a labeled fieldset between two action menus instead of nesting interactive controls inside a menuitem. This preserves keyboard and assistive access while matching the visual row.
- Focused `lab-outage-account.spec.ts`: first run 4/5 with one timing-sensitive focus assertion after returning from Settings; rerun 5/5.
- The first clean gate found that the segmented options used raw `<button>` elements outside `ControlElements`, contrary to the production control boundary. They now use `ControlButton` with the tooltip on its wrapper (React Aria omits the button's `title`). Re-captured the light/dark lab pairs: selector 98×30 and each icon button 30×26, matching the prototype. Targeted control and theme checks passed after the change. The gate also had one unrelated `workspace-slice-security` visibility timeout; its single targeted rerun passed.
