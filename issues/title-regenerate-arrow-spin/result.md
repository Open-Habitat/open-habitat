# Regenerate-title arrow restored

The shared `AgentHeader` now rotates the arrow inside the H action while its
existing naming state shows the dots. The H itself stays still. Rotation uses
`--ah-title-spin` in the shared motion tokens; the existing reduced-motion rule
suppresses both animations. No new operation state, timers or host changes.

## Verification

Tested baseline `53392dc2034d70791a465fd705fd1c58235dc197` plus this worker's
implementation. SHA-256 of the implementation/test diff after formatting:
`95cf48b969b0698cb1c5ed9114f2c58eef4f9d7a0e0756240311776e7faf19c2`.
All checks invoked with `umask 077` and a private `/var/tmp/oh-XXXX` TMPDIR;
repository scripts select disk-backed `/var/tmp`. Fleetrepo wrappers execute
heavy checks in their isolated warm Linux workspace.

- `./scripts/test-focused.sh --area web`: passed formatting, lint, typecheck,
  94 files / 558 tests. Initial attempt lacked web dependencies; installed with
  `npm ci --prefix web` and reran successfully.
- `./scripts/test-focused.sh --area browser --spec title-regeneration.spec.ts`:
  3 passed. Live failure clears arrow and dots; native-history regeneration and
  affected accessibility/layout coverage remain intact.
- `./scripts/test-focused.sh --area browser --spec lab-title-generation.spec.ts`:
  4 passed (1440/390 px, light/dark). Held success and failure replies prove
  both animations run while pending, stop with reduced motion, and remain
  stopped after completion with ordinary motion restored. Axe passes.

- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`:
  68 passed, including automatic and manual title pending-state journeys.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check`: passed.

Synthetic-lab captures show reduced-motion pending states (not live data).
Retrieved through the same pinned warm-workspace route and converted to AVIF:

| Width | Light | Dark |
| --- | --- | --- |
| 1440 | [image](evidence/pending-1440-light.avif) · [HTML](evidence/pending-1440-light.html) | [image](evidence/pending-1440-dark.avif) · [HTML](evidence/pending-1440-dark.html) |
| 390 | [image](evidence/pending-390-light.avif) · [HTML](evidence/pending-390-light.html) | [image](evidence/pending-390-dark.avif) · [HTML](evidence/pending-390-dark.html) |

## Focused self-review

Confirmed both indicators use the same `naming` expression, including automatic
snapshot pending and manual actions. The animated inner SVG group preserves
the outer translation/scale and rotates about the arrow's own 12/12 centre;
the H path is outside it. Reviewed the phone capture and existing theme/layout
assertions; no new layout dimensions or disabled-action behavior were added.
Success/failure and reduced-motion assertions exercise browser animations, not
only class names. No additional findings. No full gate, deployment or push;
these tests do not establish real-provider behavior or separate-UID isolation.
