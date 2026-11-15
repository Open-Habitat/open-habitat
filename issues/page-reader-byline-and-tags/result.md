# Result

## Cause

Readability's `_grabArticle` takes the first body node accepted by
`_isValidByline`, assigns its text to `_articleByline`, and removes the node.
On a collection of quotations this credits the whole page to the first quoted
person and leaves their quote with a bare “by”. Its unlikely-candidate regexp
also includes `tags`; short link-heavy divs face conditional removal as well.
The existing visible-text fallback does not help when enough quotation text
survives extraction.

Confirmed against the checked-in synthetic quotes structure: unmodified
Readability returns `byline: Avery Example`, zero `Tags:` lines and only one
of the two inline Avery credits.

## Change

The reader retains body credits rather than inferring a page byline from them.
Explicit page metadata still supplies a byline. Tag paragraphs/divs are
normalized to ordinary paragraphs in the extraction clone, preserving their
text, links and visibility attributes without changing the rendered page.

## Verification and review

- Focused self-review: extraction only; no daemon implementation, contract,
  session state, gateway or security-check changes. Checked clone-only mutation,
  attribution position, explicit metadata, tag links, hidden blocks, and that
  unrelated sidebar/footer clutter is still omitted.
- `node --test internal/daemon/pi-device-test/page-reader.test.mjs`: 20/20 pass
  under a 150-second process timeout and scratch lease. Tests use synthetic
  in-memory documents and local HTTP servers, not external sites.
- Slow streaming page returned its early text with `partial: true` in 4.54 s
  with a 6 s budget; the server-with-no-response case failed as expected in
  3.75 s with a 5 s budget. Existing cancellation, transfer-limit, proxy and
  Pi integration checks also pass.
- `git diff --check` passes. No browser UI changes, so no UI spec or screenshot;
  no Go, web-package or contract changes requiring their focused runners.

## Decisions for later review

- Require explicit metadata for a separate page byline even when there is only
  one inline credit. Alternative: count author-like nodes and allow inference
  for a single one. A lone quote still need not name the page author; keeping
  the credit in context avoids that ambiguity without losing information.
- Preserve semantic `div.tags`/`p.tags` annotations rather than disabling all
  Readability cleanup or returning the whole DOM. This fixes the observed loss
  while retaining article selection and removal of unrelated navigation. It
  does not promise lossless extraction of every small block on arbitrary sites.

Live check: after the conductor deploys the updated core runtime, ask an agent
on the test server to read the quotes demo page. Each quotation should retain
its author and Tags line, with no first quoted author promoted to `By:`.
