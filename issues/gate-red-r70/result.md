# Result

The composer did not jump for a person; the spec measured the old DOM.

`next-waiting-strip-lowest` (db137fc33) moved the background strip (the
Workers/assets chip row) and the next-waiting dock inside `.ah-composer`, above
the field, so the composer's wrapper now also covers them. The strip appears
when the created conversation opens, exactly as before; only now it is inside
the measured box. Measured in the failing run at 1440×900:

| | `.ah-composer` y / h | field `.ah-cbox` y / h |
|---|---|---|
| placeholder | 804 / 84 | 804 / 84 |
| created | 769 / 119 | 804 / 84 |

The field stays at the same pixel; the stream above shrinks by the strip's height.
The spec now measures the field (`.ah-cbox`), keeping its intent: creating
a conversation must not move the place where the person is typing.

Checks (`OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=15300`): the placeholder spec
3× green (6/6 each), `next-waiting-row`, `queued-send`,
`lab-composer-stack-gaps` green, `--area web` green.

## Decisions for later review

- **What stays fixed:** the typing field, not the whole composer block.
  Alternative: reserve the strip's height in the placeholder so that the block
  does not grow either. Not chosen: an empty reserved row above the field
  would look like a gap in a fresh conversation, and growing the controls into
  the stream above does not move anything the person is pointing at.
