# Result

Removed the readable worker's terminal feed marker, its unused CSS and bilingual messages, and its Explain card. Regenerated the shipped UI references. Awaiting-input, unreadable-history and Workers-panel terminal routes remain unchanged.

## Evidence

Tested changes against main ancestor `97b030bb5a8e9724394bb07a25e64779c05f4533` on Birch, with disk-backed TMPDIR, umask 077, OH_BROWSER_WORKERS=2 and OH_PORT_BASE=13000.

- `./scripts/test-focused.sh --area web`: 193 files / 1448 tests passed.
- `./scripts/test-focused.sh --area browser --spec worker-view.spec.ts`: passed, including absent readable marker, unreadable-card expansion and awaiting-input expansion, return to conversation, phone layout and axe.
- `./scripts/test-focused.sh --area browser --spec worker-panel.spec.ts`: both passed, preserving the panel/terminal journey.
- `./scripts/test-focused.sh --area browser --spec spinoffs.spec.ts`: four passed; the existing restart/quiet-rail case failed at line 467 twice. With changes stashed, the same case failed on the unchanged main ancestor. Filed unlaned as `spinoffs-settled-quiet-rail-regression`; not caused by this removal.
- The initial multi-`--spec` invocation only ran the last spec; reran the others individually.

Focused self-review: checked the diff, all remaining terminal entry points, catalog references and generated output. The old row-opening assertion is replaced by the two retained feed entry points, so terminal expansion remains covered rather than deleting that coverage. No state, daemon, contract or authority changes. Browser evidence is synthetic, not live-host/native terminal acceptance. Jari's supplied screenshot was inspected; no new visual capture was made for this deletion.

## Decisions for later review

None: implemented the requested removal without a replacement control or flag.
