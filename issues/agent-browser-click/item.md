---
created: 2026-11-27
updated: 2026-11-27
type: bug
reporter: agent
status: open
priority: normal
lane: unlaned
preparation: ready
---

# agent browser click does not select options in ARIA listbox comboboxes

## Observed (reported 27.11.2026 by an agent on a pilot installation)

On a React form using ARIA comboboxes (a `role=combobox` button or input with `role=option`
items), `open-habitat agent browser click --selector '[role=option]'` (or by the option's id)
reports success, but the option is not selected and the field stays empty. Dispatching
`pointerdown`, `mousedown`, `pointerup`, `mouseup` and `click` MouseEvents through
`browser eval` selects it.

## Done when

- `agent browser click` performs a real pointer click: scroll the element into view, compute
  its visible centre, and send the full pointer/mouse sequence through CDP
  (`Input.dispatchMouseEvent` mousePressed/mouseReleased at that point), so widgets that
  listen on pointerdown/mousedown work without eval. It reports a clear error when the point
  is covered by another element or the element is not visible.
- A browser-host test with a synthetic React-style listbox combobox (option selected on
  pointerdown/mousedown) that fails before the fix.
- The browser skill (`internal/daemon/browser-skill/SKILL.md`) and `--help` say what click does.
