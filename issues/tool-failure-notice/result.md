# Result

Removed the generic failure notice from expanded tool cards. The failure status in the corner and the native output remain visible.

## Evidence

- `lab-failed.png` and `lab-failed.html`: synthetic lab, failed bash call expanded after reload. The error status and `synteettinen komento epäonnistui` remain; no generic notice. Compared against the failed-card structure of `design-system/drafts/Agentin vuoro.proto.html`; this change does not redesign the card.
- Vitest `PiBlocks.test.tsx` asserts both the status and output and absence of the duplicate notice. Focused web checks recorded in the run log.

## Decisions for later review

None.
