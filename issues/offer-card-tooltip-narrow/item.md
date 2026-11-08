---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Offer card corner-icon tooltips render one character wide and very tall

## Description

Jari 8.11.2026, test server: on an offer card (for example a file or images
offer), hovering the corner icons (open in its own tab, download) opens their
tooltips to the right, but squeezed to about a millimetre wide and very tall,
the text standing vertically. Likely the tooltip inherits a narrow
containing block or `width`/`max-width` from the corner-icon container in
`web/src/components/OfferCard.tsx` and its CSS, so the text wraps per
character. Tooltips must size to their text (single line up to a sensible
max width) and stay inside the viewport. Check every offer kind and the other
tooltips that use the same mechanism. Fixing agreed behaviour; no prototype.

## Acceptance Criteria

- [ ] Offer card corner-icon tooltips are readable single-line (or normally wrapped) at 1440 and 390, inside the viewport.
- [ ] Regression check (spec measuring tooltip width) and touched specs green.
