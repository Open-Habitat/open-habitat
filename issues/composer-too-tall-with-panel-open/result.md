# Result

The composer's field no longer takes a fixed share of the viewport. The
conversation frame now also measures its own height, and the field grows to at
most a third of what the header and the bottom panel leave (a quarter while
the panel is open), never above the earlier 268 px and never below one line.
Beyond that the draft scrolls inside the field. Opening or heightening the
panel therefore lowers the field instead of squeezing the conversation.

`web/tests/browser-shell.spec.ts` ("a long draft scrolls inside the composer
…") checks on desktop with the panel closed, open and heightened, and on a
phone, that the field scrolls internally, that the conversation keeps at least
the composer's height, and that the field gets lower as the panel takes more.
Setting `OH_COMPOSER_CAPTURE=<dir>` writes the screenshots in `attachments/`
(device scale factor 2).

## Decisions for later review

- **The bound is a share of the remaining room: a third, a quarter with the
  panel open.** Alternatives: a fixed lower pixel cap when the panel is open,
  or a viewport fraction. The room-based share follows the person's panel
  height and the phone keyboard-less height; a quarter keeps about four lines
  at a 376 px panel on a 900 px screen while the conversation still has more
  height than the composer.
- **The 268 px ceiling stays.** On a tall screen with the panel closed the
  field is exactly as before.
- **Phone with the panel open is unchanged.** There the panel covers the
  conversation and the composer altogether, so the bound only matters with the
  panel closed (about a third of the screen).
