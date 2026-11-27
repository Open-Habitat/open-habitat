# Result

An offered view (or offered HTML page) now starts in the theme Habitat is
showing, in the side panel and in its own tab, including Järjestelmä.

## How it works

- The view frame inherits Habitat's root `color-scheme`, which theme.ts already
  set, so `prefers-color-scheme` inside the sandboxed, cross-origin view
  matches Habitat's resolved theme. Confirmed in Chromium, also in a probe
  outside the suite. Firefox follows the embedder's `color-scheme` as well.
  Safari is not verified here, which is why there is also a hint:
- The frame URL carries `#ah-theme=light|dark`, fixed when the view opens. A
  fragment is never sent to the view host and survives the hand-off
  redirects. The sandbox, CSP and gateway are unchanged. Contrast counts as
  dark.
- Prototype shell: `lib/stage.js` (library rounds) starts its Teema picker on
  the hint, otherwise on Järjestelmä, which follows the frame's
  `prefers-color-scheme`. Rounds built from production components with their
  own `build.mjs` get `lib/view-theme.js` `initialTheme()`: the round's own
  `?theme=` first, then the hint, then `prefers-color-scheme`. A choice made
  inside the view still wins. `design-system/prototypes/AGENTS.md` tells
  round workers to use it.
- The agent guide (host-context.md) mentions the hint where views are
  described.

## Old rounds

Offered views are frozen copies, and the shell is built into each round's
HTML, so nothing changes at view time for rounds that were already offered.
Library rounds built with the shared `build.mjs` already defaulted to
Järjestelmä, so they now follow Habitat in Chromium and Firefox without a
rebuild. Most production-component rounds pin their picker to light
(`reviewTheme = 'light'` or `?theme=` with a light fallback), and they keep
opening in day mode until a round is rebuilt with `initialTheme()` and offered
again. The existing round sources were not mass-edited.

## How to try

Put Habitat in Yö (night) mode while the device stays light. Open a new
prototype round's view card in the side panel, then open the same card in a
new tab. Both should start dark. Switching to Päivä inside the view still
works. In Järjestelmä mode the view follows the device.

## Tests

- Playwright `agent-views.spec.ts` › view theme: the panel and the own tab
  with Habitat in Yö (device light) and in Järjestelmä (device light), each
  asserting the view's `prefers-color-scheme` and the hint. The whole spec,
  `view-links`, `agent-file-offers`, `reply-view-file` and `site-onboarding`
  pass.
- `node --test design-system/prototypes/view-theme.test.mjs`.
- `scripts/test-web-fast.sh`, plus focused Go runs of `internal/gateway` and
  `internal/daemon`.
