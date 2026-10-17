# Result: the server name goes home; rail rows show hover

## Cause

- The server name was plain text in a `<strong>`.
- The rail's background (`--ah-rail`, light `#f1f3f5`) is almost the surface
  hover colour (`--ah-surface-hover`, `#f2f4f6`) that the button system gives
  quiet rows. Etusivu and conversation rows therefore did not visibly change
  on hover in light. In dark the difference was faint.

## Change

- `WorkspaceRail` (`web/src/components/Navigation.tsx`): the server name is a
  `LinkRow` (kind `header`) to `/workspaces`. Its accessible name is the
  visible server name, and its tooltip says "· Etusivu". The phone drawer
  closes on any navigation, as with Etusivu.
- `components.css`: inside `.ah-rail`, `--ah-surface-hover` and
  `--ah-surface-press` are the ink tint (`--ah-control-hover/press`). This
  uses the button system's hover rule instead of adding per-row CSS, and it
  covers every rail row in both themes. The server link clips its own long
  name.

## Evidence

- Browser (host-backed synthetic):
  `browser-conversation.spec.ts` "rail server name goes home by mouse,
  keyboard and from the phone drawer; rail rows show hover". The test checks
  mouse and Enter navigation and that the phone drawer closes. In light and
  dark, Etusivu's hover background must equal the rail's ink tint. The old
  colours fail that check.
- Paired lab captures, made with `web/lab/capture-rail-marks.mjs` (rail
  region; HTML twins for after):
  - `before-home-hover-{light,dark}.png` and `after-home-hover-*`: Etusivu
    under the pointer.
  - `before-row-hover-*` and `after-row-hover-*`: a conversation row under
    the pointer.
- The design drafts specify no rail hover colour, so there was no draft
  image to pair with.
- Limits: synthetic lab only, not the live server.

## Decisions for later review

- Hover in the rail is the same ink tint as the text buttons' hover, not a
  new token.
