---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: agent observation during prototype round
source_ref: taskfleet:01m5pehp8ctt4ajq7e7dx6sfje/observation:attachment-menu-styles
originating_run: 01m5pehp8ctt4ajq7e7dx6sfje
originating_run_kind: spinoff
lane: unlaned
collision: [web/src/components/composer]
preparation: ready
commits:
- hash: cfa8c94d96735733772a684202f1331640dbf6d6
  summary: 'test: record synthetic attachment menu visual evidence'
- hash: dd637f8f12ec643112b5660eccfc7e3465c2a858
  summary: 'fix: restore the attachment menu surface with its owner'
closed: 2026-10-24
---

# Liitä menu popover lost its styles with browser folder sharing removal

## Description

The composer's Liitä popover (`web/src/components/composer/AttachmentMenu.tsx`: `.ah-attachment-popover`, `.ah-attachment-dialog`, `.ah-attachment-close`, `.ah-attachment-choices`) has no CSS rules in production. They lived in `web/src/components/LocalFolder.css`, which 22c53a9b ("remove browser folder sharing end to end") deleted together with the folder panel. `grep -rn attachment-popover web/src --include=*.css` finds nothing on main (eac5eec6).

Effect: the popover renders with no surface background, border, width or padding, so the *Tiedosto liitteenä…* choice floats transparently over the conversation.

Fix: move the five surviving rules (the removed file's `.ah-attachment-popover` … `.ah-attachment-choices p`, minus `.ah-local-folder`) into `composer.css` or `components.css`; add a story or visual check for the open menu.

Observed while building the prototype round of `proto-cloud-folder-bridge`, which restores these rules in its own round.css.

## Acceptance Criteria

- [x] The attachment menu has an opaque, bordered, padded token-based surface owned by AttachmentMenu, fitting desktop and 390 px viewports in light and dark themes, with an open production story and browser regression coverage.

## Result

Implemented by `dd637f8f`: `AttachmentMenu.css` is imported by the owning component, independent of the deleted folder panel. React Aria's available overlay height bounds scrolling. The open Storybook story uses the real trigger and portal; its theme follows the toolbar even outside the in-flow decorator.

Final verification on `cfa8c94d96735733772a684202f1331640dbf6d6` (tree `47d6f4b502a1321909c4cacbfc11dab915e2cc31`), after rebasing onto current main and refreshing the changed dependency lock:

- `./scripts/test-focused.sh --area web`: format, lint, typecheck and all 104 test files / 634 unit and component tests passed, including composer tests.
- `./scripts/test-focused.sh --area browser --spec composer-geometry.spec.ts`: 4 passed; rendered opaque surface, border, padding, viewport containment and focus restoration checked at 1440/390 px in both themes.
- `./scripts/test-focused.sh --area browser --spec lab-composer-area.spec.ts`: all 10 passed, including the four attachment focus, selection, draft-retention and Axe journeys.
- `npm run build-storybook --prefix web`: passed before rebase, with the same attachment story/component sources.

An earlier lab run failed waiting for the unrelated `/rev` completion option; both the immediate rerun and final post-rebase full spec passed without code changes to that interaction. The first post-rebase static check needed `npm ci --prefix web` for the newly landed document-preview dependencies; the subsequent complete run passed.

Synthetic lab evidence, captured before rebase with unchanged attachment sources, reviewed at all four sizes/themes (capture-only, not automated screenshot comparisons):

- [1440 light](evidence/attachment-1440-light.png) · [offline HTML](evidence/attachment-1440-light.html)
- [1440 dark](evidence/attachment-1440-dark.png) · [offline HTML](evidence/attachment-1440-dark.html)
- [390 light](evidence/attachment-390-light.png) · [offline HTML](evidence/attachment-390-light.html)
- [390 dark](evidence/attachment-390-dark.png) · [offline HTML](evidence/attachment-390-dark.html)

Browser evidence uses the isolated synthetic host/fake Pi via the fleet runner, not a live account or proof of Linux UID isolation. No deployment, full clean gate or push was performed.
