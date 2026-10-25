# Result

## Cause

The person's own bubble rendered its text literally (`.ah-user-text`, pre-wrap
span). That was the 2026-10-19 fix for `user-bubble-joins-typed-lines`: plain
Markdown treats a single newline as a soft break and joined typed lines into
one paragraph, so that fix stopped interpreting Markdown at all. Jari now
wants the formatting back without losing the lines.

## Fix

- `web/src/components/remarkBreaks.ts`: a small remark plugin that turns each
  newline in prose text into a line break. Code nodes are not touched.
- `Markdown`/`MarkdownRenderer` take `breaks`; only the person's messages use
  it, agent replies keep ordinary soft breaks. The renderer is unchanged
  otherwise (same sanitize schema, `skipHtml`, URL filter).
- `UserMessage` (live and plain history), the history text blocks rendered for
  a user entry (including skill arguments) and the held `WaitingMessage` render
  `<Markdown breaks>` on the attachment-stripped text. The held bubble follows
  so that a message does not change appearance when Pi takes it.
- The collapse, attachment chips outside it and copy (the caller's original
  text) are unchanged. `UserMessage`'s body gained `data-testid="user-content"`
  (the held bubble already had it).

## Evidence

- Component tests (`Markdown.test.tsx`, `HistoryView.test.tsx`) replace the
  two "kept literal" cases: sent and held bubbles render `**worker**` as
  `<strong>`, list items as a list, keep one `<br>` per typed newline, and drop
  `<script>`. The history case covers no blocks, empty blocks and native text
  blocks, and checks that copy yields the unchanged source. With
  `remarkBreaks` removed, all five fail.
- `./scripts/test-focused.sh --area web`: 118 files, 748 tests passed.
- `--area browser`: `browser-conversation.spec.ts` 70/70 (including the
  seven-painted-lines and 8-line fade case), `attachments.spec.ts` 1/1,
  `queued-send.spec.ts` 10/10.

## Not tested

- `lab-skill-invocation.spec.ts` needs the synthetic lab. Its selector moved
  from `.ah-user-text` to the user-content Markdown, but the spec was not run.
- No screenshot taken. Raw HTML the person types (e.g. `<div>`) is dropped
  from the bubble, as in agent replies; copy still has it.
