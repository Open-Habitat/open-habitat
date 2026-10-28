# Result

Reproduced in the lab (`pi-deltas`, prompt "pitkä virta") with a
MutationObserver on the reply: a settled reply's code `<figure>` was removed
and re-inserted about once a second while idle and on every delta of a live
turn (79 times in 4 s), and a mouse selection was gone within half a second.

Two causes, both fixed at the source:

- `MarkdownRenderer` gave ReactMarkdown new component functions (`pre`, `a`,
  `code`, `img`, `table`) on every render. React compares component types by
  identity, so each re-render of a reply remounted every code block, link and
  inline code. The components are now module-level (the fence check reads the
  source through a context) and the renderer is memoised on its text.
- A streamed paragraph was one DOM text node whose whole value React rewrote
  on each delta; DOM "replace data" collapses any range inside that node.
  `rehypeStableText` splits prose text (and plain code text in `SyntaxCode`)
  into 64-character pieces at fixed offsets, so appended text changes only the
  last piece and earlier text nodes are untouched.

Evidence: `web/tests/lab-reply-selection.spec.ts` selects by mouse, extends
by Shift+ArrowRight, and holds the selection through more than ten streamed
deltas and in a settled reply; it fails on the previous code at the live
check and, with only the remount reintroduced, on a detached code block.
`MarkdownRenderer.test.tsx` covers the same invariants in jsdom.

## Decisions for later review

- Piece size 64 characters. A selection inside the last, still-growing piece
  (at most the last 63 characters of a streaming paragraph) still collapses.
  Alternatives: larger pieces (fewer nodes, bigger unstable tail) or
  restoring the selection after each update (rejected: it repairs a symptom
  and fights the browser's own drag selection). 64 keeps the unstable tail
  under one visible line.
- Not covered: the moment a running turn settles. The live timeline item
  (`live-turn-…`, steps keyed by provisional ids, `<Markdown>`) is replaced
  by the history item (`turn:<entry>`, `OrderedBlocks`), so the turn remounts
  once and a selection made during the stream is lost then. Unifying the
  live and saved turn identity is in the scroll/turn code another worker owns;
  filed as `selection-lost-when-turn-settles`.
