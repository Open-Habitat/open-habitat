# Result

When the shell in the bottom panel ends itself (`exit`, Ctrl-D), tmux ends its
session and the daemon reports `exit: ended`. The browser now drops that tab at
once instead of waiting for the next list read, and closes the panel when it
was the last tab. With other tabs open, only that tab goes and the next one is
shown. The same rule applies to a watched Taskfleet window that closes.
Nothing else is ended: the browser only reacts to the shell's own end.

`web/tests/browser-shell.spec.ts` covers Ctrl-D in one of two shells (the other
survives and takes input) and the last shell (panel hides, the toggle then
opens a fresh shell); the long tabs journey now expects `exit` to hide the panel.

## Decisions for later review

- **Other tabs stay open.** Ctrl-D in one of several shells removes only its
  tab; the panel closes only with the last one. Alternative: close the whole
  panel on any exit. Chosen because it matches the × button, which also closes
  the panel only for the last tab.
- **No toast when the panel closes.** The person ended the shell and the panel
  disappearing is the acknowledgement. With tabs remaining the existing
  "Pääte päättyi" toast still explains the vanished tab.
- **Focus is not moved.** After the panel closes focus falls back to the
  page, as with the hide button. Moving it to the composer would be a separate
  change for every way the panel closes.
