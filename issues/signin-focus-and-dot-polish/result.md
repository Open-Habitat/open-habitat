# Result

## Cause

1. A return from the forced Pi sign-in opened in Settings › Yhteydet always
   focused `[data-testid='pi-sign-in']` (the OpenAI row's button): the
   sign-in view's completion callback carried no word of which provider
   signed in.
2. The start-page card drew *Työskentelee* as its own open accent ring that
   blinked (`.ah-home-dot-working`, `ah-home-blink` in `HomeWorkspaces.css`);
   the sidebar drew a filled pulsing accent dot, and `StatusMark
   kind="working"` (conversation turn progress, Jatka-näkymä, live tool rows)
   a filled dot in `currentColor` that pulsed only when `animated`.

## Fix

1. `PiOnboarding`'s `onUsable` takes `"claude"` when its Claude row signed
   in; `GitHubOnboarding.finish` passes it on; `App`'s `returnFromPiSignIn`
   remembers which row to focus. Claude: the settings row
   (`claude-sign-in`, now `tabIndex={-1}`), because its own button is
   disabled until its state has been read again after the remount.
   Otherwise (ChatGPT, a status read, *Takaisin*): the OpenAI row's button
   as before.
2. One working-dot rule in `components.css` for the sidebar mark, the
   start-page card dot and `.ah-status-working .ah-status-dot`: a filled
   `--ah-accent` dot that pulses with `--ah-pulse`; with reduced motion it
   stands still inside an `--ah-accent-line` ring. A new reply's mark still
   wins on the start page (`:not(.ah-home-0)`, as for the background dot).
   The home page's blink keyframes are gone.

## Evidence

- `account-settings.spec.ts` new case "Claude sign-in from settings returns
  to Claude's row": OpenAI row → forced view → choose Claude → code →
  back at `/settings/connections` with the Claude region focused. With the
  provider choice mutated back to always-OpenAI the case fails on
  `toBeFocused`. Whole spec: 16 passed.
- `./scripts/test-focused.sh --area web`: passed (749 tests, lint, types).
- `evidence/start-*.png`, `start-card-*.png`, `sidebar-*.png` (light/dark):
  the working card and sidebar row show the same filled accent dot (frames
  may catch it mid-pulse). `evidence/capture.spec.ts` retakes them when
  copied to `web/tests/`.

## Not tested

- No screenshot of the conversation's *Agentti työskentelee* row or
  Jatka-näkymä; they get the shared rule through `.ah-status-working`
  (accent instead of the text colour, and they now pulse even when the mark
  is not `animated`, e.g. Jatka-näkymä's activity mark).
- Reduced-motion rendering was not captured.
- A real Claude sign-in on Birch (synthetic `claude-login` route only).
