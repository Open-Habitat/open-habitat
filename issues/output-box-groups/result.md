# Result

Bash output and fenced reply code now share `OutputBox`. The rail groups copy, three views, scroll-only jump actions, wrap and own window. Only the view and wrap toggle retain pressed state; jump availability follows actual scroll. Output is unwrapped by default, with synchronized horizontal scrolling for head/tail, continuation indent when wrapped, and no code ligatures. Running output initially follows the end unless the reader scrolls away.

The production renderer keeps the existing Markdown sanitizer and URL policy unchanged. The prototype's `scroll` icon and wrap icon are distinct in production; short boxes show copy and wrap, without an unnecessary view selector. The existing command-fold behavior remains.

Synthetic lab paired evidence: `lab-desktop.{png,html}`, `lab-phone.{png,html}`, `lab-dark.{png,html}`. Captures show the saved bash card opened with a 53-line output; the same reply also contains fenced code. The dark capture uses the application's dark theme attributes and color scheme. These are synthetic fake-Pi views, not live-user or separate-UID evidence.

Checks: `./scripts/test-focused.sh --area web` passed; focused browser conversation saved-turn test passed, then the full `browser-conversation.spec.ts` passed with `OH_BROWSER_WORKERS=2` (69 cases). The initial 8-worker browser run passed 66/69 and timed out in three unrelated login/restart journeys while opening `ordinary-dir`; the bounded lower-worker retry passed. `BashToolCard.test.tsx`, `OutputBox.test.tsx` cover the view, scroll-end disabling, wrap and full copy. The saved-turn browser test runs Axe against the bash card. No full clean gate result is claimed here.
