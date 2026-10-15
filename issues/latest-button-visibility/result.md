# Result

The reading viewport now observes the timeline and viewport size after native history loads. Expansion, collapse and other layout changes recalculate whether the end is visible without waiting for a scroll event. The plain latest action is an icon-only button with an accessible name.

## Evidence

- `lab-expanded.{png,html}` and `lab-collapsed.{png,html}`: same synthetic lab conversation at 1440 × 1500, long bash output expanded to all rows and then closed. The arrow appears when expanded and disappears when the end is visible. The draft's conversation column remains aligned; the latest button's dedicated prototype round is not preempted here.
- Browser case `latest action tracks expanded height and centers its arrow` passed (1/1); element rectangles in the lab: button x=844 width=48, icon x=859 width=18; centre offset 0 px.

## Decisions for later review

- The button shows only the arrow when there is no unread count, leaving the counted-content button unchanged; this centers the icon without redesigning the future prototype.
