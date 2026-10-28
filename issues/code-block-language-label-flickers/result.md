# Result

The flicker had two parts.

- The settled reply re-rendered about once a second and each re-render
  remounted the code block (see `text-selection-lost-in-agent-reply`). A new
  element under a resting pointer is first styled without `:hover`, so the
  label appeared at full opacity and faded out again on the next pointer
  move. Fixed with that issue's stable Markdown components.
- The label was hidden on `:hover` and `:focus-within` of the whole code
  window, so moving between the copy control and the edge of the block, or
  tapping copy on a touch screen (sticky hover and focus), toggled it.

The label now stays visible under the pointer and on touch. It sits over
space reserved for it, so it only covers content when a scrollable output
window is scrolled down; it fades only then (`ah-output-scrolled`).
`web/tests/lab-reply-selection.spec.ts` samples the label's opacity while
moving over the copy control and checks the code window is never replaced.

## Decisions for later review

- Label visible on hover instead of hidden. Alternative: keep hide-on-hover
  and fix only the remount; rejected because touch still toggles it on every
  tap of copy. The file diff card (`FileToolCard`) keeps its hover rule: its
  label overlaps the first diff line and there is no reserved space there.
