# alice-08-returns-workers

Alice · 13:35 · Returns: 30 days. Five workers change the returns policy
across the site and the handbook; a checker on a second model sends two pages
back.

## What changed and why

- **Story.** The left-hand text now runs like the work does: the ask on the
  way into a meeting, 17 pages found, the split into workers, the checker
  sending two back, and the work waiting for her yes when she comes out. It
  ends on the result she wanted, the three questions customers ask most.
- **The plan is visible.** The turn has an interim stage: two tools (`grep`
  for the pages, `notmuch count` for the emails) and an interim reply that
  says which worker does what, on which branch, and that nothing goes live
  without her. The final stage reads the mail worker's report, both checker
  rounds and the `git diff --stat`, with short outputs that fit 390 px.
- **Workers panel** follows `docs/assets/readme/workers.png`: slug names
  (`mail-questions`, `shop-floor`, `online-orders`, `site`, `checker`), a
  meta line ending in the harness (“Pi”, the checker “second model”) and the
  elapsed time on the right.
- **The view is a review of the branch** (`returns-30-days` → main, 17 pages,
  +49 −30), with three tabs using the engine's `data-view` toggle:
  - *site/faq.md* (default, and what reads without JavaScript): a diff with
    old and new line numbers, the changed words highlighted, and for each new
    answer how many customers asked it (71, 38, 27, 19). That count comes from
    the mail worker's report and is what ties the work to “what customers
    actually ask”.
  - *17 pages*: the files grouped by the worker that changed them, with
    +/− and the five-square size bar; the two pages the checker sent back
    are marked “sent back · fixed”.
  - *Checker*: the two rounds, what was sent back to whom, and the pass.
  Each worker keeps one colour (from `--ah-glyph-*`) across the tabs.

## Assets

None. Everything in the view is text drawn in HTML/CSS, so it needs no
binaries.

## Assumptions about the product

- Workers run on their own branch or worktree and the parent agent merges
  only after the person agrees (the reply ends “Merge them?”; `alice-day` has
  “Merging” at 13:50).
- A worker can run on a different model from the others. The panel names no
  model, to avoid anything that reads like a comparison.
- `notmuch` stands for an installed mail index in Alice's account (the round
  already reads her mail in `alice-03`).

## Engine needs

- `workers()` has no “ended” group or per-row meta beyond one task line. The
  product (`workers.png`) folds finished workers under “N ended” and shows a
  status word (“merged · worktree still there”). Here every worker is done,
  so the harness and the outcome go into the task line.
