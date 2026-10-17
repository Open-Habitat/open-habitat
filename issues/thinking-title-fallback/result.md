# Result

A reasoning block that does not start with a standalone bold heading now gets the first line of its first paragraph as its title. This is Claude's shape; OpenAI summaries do start with one. The title has its Markdown marks removed (heading, quote and list markers, `**`, `__`, backticks), whitespace collapsed, and is cut to 120 characters with "…". The row's CSS ellipsis then fits it to one line. Unlike an extracted heading, the preview line stays in the opened reasoning, because it is part of the text and not a separate heading. Titled blocks are unchanged. Live (streaming) and redacted reasoning are unchanged. The rule is the same for every provider: it looks only at the text.

Layout fix found on the way: a long title widened the turn on a phone. `.ah-ordered-blocks` children were grid items with `min-width: auto`. They now have `min-width: 0`. The tool-header, file-card and syntax-wrap browser specs still pass.

Screenshots (synthetic lab conversation, one OpenAI-shaped titled block and two Claude-shaped untitled blocks injected at the validated history boundary, `capture.mjs`): `lab-{desktop,phone}-{light,dark}-titles.{png,html}`.

## Tests

- `AgentTurn.test.tsx`: an OpenAI-shaped block keeps "Interpreting extension messages". Claude-shaped blocks get their first line (leading blank lines skipped, backticks removed, list marker removed), and a long first line is cut with "…" within 120 characters. The earlier "does not extract an inline, later or unfinished heading" cases now check that these get a preview title and that the line stays in the body.
- `thinking-title.spec.ts` (host-backed): a third, untitled block shows its first line as the title on the same row as "Ajattelu", fits at 1440 and 390 px, and the opened body still contains the line. Axe has no violations.

## Decisions for later review

- **120 characters before CSS ellipsis.** The full first line is in the button's `title` tooltip and accessible name up to that length. A longer accessible name would read a whole paragraph aloud for one button.
