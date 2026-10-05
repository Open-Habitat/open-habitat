# Result: mapped draft / lab comparison

Implementation: `web/lab/measure-fidelity.mjs` reads `web/lab/inventory.json` for the state and landmark map, opens isolated draft and synthetic-lab browser contexts, measures computed styles, rendered dimensions and accessible role/name controls, and writes `pairs/report.{json,md}` plus AVIF pairs. It records absent or ambiguous landmarks, unmapped states, failed comparisons and content mismatch as gaps rather than matches. A property-specific canonical treatment can be declared only with an exact draft variant and rationale; an approved deviation needs exact measured values and a `design-system/design.md` reference. No blanket pixel threshold is used. The foundation browser assertions now use inventory selectors for the properties they already check.

## First run

- Compared implementation revision `42810e4860690939bcd8fcd928696b71048d7eb3` with drafts at the same revision in the synthetic lab, at 1440 × 900 and 390 × 844, light and dark. [Full report](pairs/report.md), [machine-readable results](pairs/report.json), and 16 AVIF screenshot pairs (all under 1 MiB each, 724 KiB total) are committed here. The captures are synthetic, not live-user sessions.
- Four onboarding states (sign-in, repo chooser, Pi start, Pi code) produced all 16 pairs. The run measured 182 unresolved property/control differences; for example the sign-in phone card has 20px draft top padding versus 26px in lab, and the Pi code view uses differently named copy/open controls. Typography differences include a 21px draft onboarding heading versus 20px in the lab sign-in. The code state was confirmed by waiting for the synthetic `ABCD-1234` code before capture.
- The inventory lists 79 unmapped or unreproducible counterparts. The older conversation draft has different synthetic conversation content and has been superseded for navigation and blocks; it is a gap, **not** a valid paired metric reference. All measured onboarding screens also have differing explanatory/fixture copy; the report marks this mismatch and does not interpret text-dependent card height as design drift. No recorded design.md visual exception applies to these mapped measurements, so none is silently classified as approved. No repeated-draft accidental variation was established in these four states; the explicit canonical-variant facility has no entries yet. A later design round must curate these from repeated examples and tokens, not infer them from a pixel threshold.

Rerun (from the repository root, with dependencies installed and synthetic browser cache):

```sh
TMPDIR=/var/tmp/native-agent-host-build ./scripts/lab.sh start
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/measure-fidelity.mjs issues/<round>/pairs
./scripts/lab.sh stop
```

Use a separate issue directory for each round. The output folder must be under `issues/` or `.cache/lab/`; the command refuses any non-lab host. Expand `inventory.json`'s `landmarks` only when a draft state and synthetic lab state really correspond. This report establishes mapped onboarding measurements, not complete design parity, contrast/a11y compliance, or a live installation verdict. The next design issues should use the unresolved controls and visual pairs alongside the inventory gaps, not treat this count as a pixel-fidelity score.

## Validation and review

- The comparison was executed against the committed implementation and produced all 16 pairs; no mapped comparison failed. `npm run typecheck --prefix web`, targeted Biome lint/format, `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and `git diff --check` passed. Final clean gate result follows below.
- Self-review after inspecting the diff and the captured Pi-code phone pair: this is a synthetic-only browser tool and selector refactor, with no authentication or server-authority change. Runtime failure risk is localized to coverage and reporting. The run itself tests the mapped states at every requested presentation; the gate covers the reused foundation assertion. The principal residual risk is that draft copy and lab content are not identical, so height and any unmapped control must remain a gap instead of a claimed match. A targeted local review plus gate is proportionate to this isolated tool; no model review was invoked.
