# Result

The collapsed bash row now mounts its command loader before expansion. The first command line appears in the header even when native history supplies arguments through a deferred block fetch. Other tool bodies remain lazy.

## Evidence

- `lab-collapsed.png` and `lab-collapsed.html`: synthetic lab, saved conversation after reload; `bash ls` visible while `aria-expanded=false`. The row and command alignment follow the collapsed bash row in `design-system/drafts/Agentin vuoro.proto.html` (name then inline monospace command).
- Focused browser case `saved assistant turn exposes bash command` checks initial collapsed header; the full spec's first run had five unrelated login/setup timeouts in the concurrent fake host. Targeted rerun passed (1/1, `OH_PORT_BASE=15100`).

## Decisions for later review

None.
