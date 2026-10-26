# Result

Cause: `controlClassName` gives a button with a `presentation` only that
presentation's class instead of the `.text` shape, so the `floating` chip never
got the inline-flex row layout. Its trailing arrow (a block SVG) wrapped onto a
line of its own and stretched the chip. The fix puts `.floating` in the shared
inline-flex rule, keeps it on one line (`white-space: nowrap`) and gives the
pill's rounded ends one spacing step more inline padding than a row button.
The jump-to-latest chip is the only `floating` user, so no other control
changes.

Evidence, all at device scale factor 2, captured from the new Storybook story
`Production/Conversation recovery/Jump To Latest {Light,Dark}` with
`web/lab/capture-jump-latest.mjs` (desktop 1000 px, phone 390 px):

- before: `screenshots/before-<desktop|phone>-<light|dark>-<idle|reply|working>.png`;
  arrow centre 7.8 px below the chip centre, chip 33.6 px high
  (`screenshots/before-boxes.json`).
- after: `screenshots/after-…png`; arrow on the chip's centre line, chip at the
  row height (32 px desktop, 40 px phone) (`screenshots/after-boxes.json`).

The existing browser case "latest pill names working and unread reply with its
count" now checks the arrow sits on the chip's vertical centre; it fails on the
old CSS (offset 7.8) and passes with the fix.

## Decisions for later review

- Inline padding is `row pad + s1` (16 px) rather than a new token; the chip
  stays at the row role's height.
- No truncation for very long labels: the longest real form fits a 390 px
  phone with room to spare, so `nowrap` was preferred over ellipsis.
