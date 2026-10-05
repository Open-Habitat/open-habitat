# Designer drafts

This directory contains the current design's reference screens and their shared
`support.js`. The design is described in [design.md](../design.md); the live
components are in `web/src/components/` and the shared values in `../tokens/`.

Update these references in place when the design changes. Git preserves earlier
versions. For navigation, the return view, workspace page, and settings, the
current reference is `Navigaatio ja asetukset.dc.html`. Older roundups
(`Selainpolku`, `Puhelin`, `Tummat näkymät`) remain references for conversation
and other views, but their overlapping navigation and settings examples are not
the current target. Future packages should select by view ownership instead of
presenting the older examples as competing designs.

The HTML files are simulated prototypes, including their state controls and
network-loaded preview libraries. Inspect them in a separate browser context
without a personal profile. The synthetic lab comparison scripts supply bundled
fonts and keep the prototype context separate from the application.
