# Designer drafts

This directory contains the current design's reference screens and their shared
`support.js`. The design is described in [design.md](../design.md); the live
components are in `web/src/components/` and the shared values in `../tokens/`.

Update these references in place when the design changes. Git preserves earlier
versions. For navigation, the return view, workspace page, and settings, the
current reference is `Navigaatio ja asetukset.dc.html`. Shared control interaction
states and the agent-state presentation are in `Kontrollitilat ja agentin
tila.dc.html`; states that require facts the host does not yet provide are
conditional examples, not current production behavior. `Agentin vuoro.proto.html` is the agent-turn reference chosen from the `/prototype` rounds of 2026-10-12: it plays a working turn (R replays) and overrides the older draft's bubble-free reply and collapsed thinking. `Pi-keskustelun lohkot.dc.html` remains the conversation-content reference for the other block families;
its resolved-question history and other fact-dependent examples are conditional
until native evidence exists. Older roundups (`Selainpolku`, `Puhelin`, `Tummat
näkymät`) remain context for other views, but their overlapping navigation,
settings and conversation-block examples are not competing targets. Future packages should select by view ownership instead of
presenting the older examples as competing designs.

The HTML files are simulated prototypes, including their state controls and
network-loaded preview libraries. Inspect them in a separate browser context
without a personal profile. The synthetic lab comparison scripts supply bundled
fonts and keep the prototype context separate from the application.
