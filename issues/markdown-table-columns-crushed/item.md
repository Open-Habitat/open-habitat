---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-12/md-tables
lane: unlaned
preparation: ready
---

# Markdown tables crush short columns so dates and numbers break mid-word

## Description

Jari 12.11.2026 (screenshot beside this issue): a Markdown table in an
agent's reply renders with the short columns squeezed to a character or two,
so their values break mid-word: dates "11-10" wrap as "11 / -1 / 0", hours
"8,25" as "8, / 2 / 5", the header "Pvm" as "Pv / m". The long description
column takes all the width.

Expected: short cells never break inside a word or number; columns size to
their content (short columns keep their natural width, a long text column
wraps), and a table wider than the column scrolls horizontally on its own
rather than crushing columns. Applies to conversation replies and every
Markdown view in the product.
