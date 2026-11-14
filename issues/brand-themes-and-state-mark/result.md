# Result: three themes, the new mark and the mark as the agent state indicator

Päivä, Yö and Korkea kontrasti replace the light and dark themes; Settings › Ulkoasu and the account
menu offer all four choices, and Järjestelmä picks Korkea kontrasti on `prefers-contrast: more`.
`HabitatMark` draws the new mark in every place that showed an agent state as a ball or dot, through
one mapping (`web/src/components/markState.ts`); the rail follows wide rail B and narrow rail N2, the
worker branch mark is gone, the header shows failure, a stop, Pi thinking and a pending question,
the landing plays the intro once, and the favicon is the new mark. Story: Production/State mark.

## Decisions for later review

- The issue's token blocks predate the boundary contrast work; its palettes are kept and the
  boundary tokens hold 3:1 (4.5:1 in Korkea kontrasti). Yö `--ah-accent-line` `#4c8447`, contrast
  `--ah-accent-line` `#b3b3b3` and `--ah-err-soft-press` `#3a0f08` replace values that measured
  below target.
- Worker `waiting_parent` (the worker waits for its main agent) rests as `idle`; a worker the main
  agent waits for (`waited`) and that works is `awaited`, as the table's gloss describes.
- Narrow rail: the resident stands at the door for waiting (knocking), read (hollow, dashed ring)
  and error (hollow), since the icon takes the resident's place.
- A neutral header status draws `unknown`; the editor strip rests on the logo when it knows neither
  work nor an unread reply.
- code-server keeps its own default theme in every theme: the daemon writes no
  `workbench.colorTheme`, and the theme is a browser-side choice.

## Evidence

- `web/lab/measure-boundaries.mjs`, extended to the contrast theme: 0 failures.
- axe text contrast over 353 production stories per theme: Yö and Korkea kontrasti clean apart
  from decorative content; in Päivä the two known shortfalls remain (the replaced continuation in
  Palaa tähän at opacity 0.6, 4.34:1, and a `small` in the Markdown conversation story, 3.84:1),
  plus dimmed decorative previews and xterm faint text.
- Web: biome, tsc, vitest 1648 tests. Browser: theme, rail (groups, now, unread, turn-returns,
  icons-quiet, interrupted-turn, running-after-done, hover-marks), raise-to-your-turn, spinoffs,
  worker-badges, process-tray, auth-failed-turn, account-settings, design-system — all pass.
- Independent review (`/llm-review`, two models): seven findings, all confirmed and fixed.
- Synthetic lab and Storybook screenshots at 1440 and 390 px in all three themes and forced colours.
