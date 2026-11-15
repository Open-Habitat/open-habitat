---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/page-reader-byline-and-tags
lane: unlaned
lane_seq: 1
preparation: ready
---

# Page reader takes a quote's author as the page byline and drops tag lines

## Description

Agent test 15.11.2026 (test server, `web-page-reader` now works): reading
https://quotes.toscrape.com/js/ gave quotes, links and a screenshot, and a
PDF URL answered "not a web page". But the text has a heading
`By: Albert Einstein` and the first quote ends in a bare `by`: the reader
took the first author link as the whole page's byline (Readability's
byline), and every quote's "Tags:" line is missing from the text although
it shows in the screenshot. The agent can thus report wrongly who said what.
The slow-page timeout was not tried.
