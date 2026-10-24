---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: agent observation during prototype round
source_ref: taskfleet:01m5pehp8ctt4ajq7e7dx6sfje/observation:attachment-menu-styles
originating_run: 01m5pehp8ctt4ajq7e7dx6sfje
originating_run_kind: spinoff
---

# Liitä menu popover lost its styles with browser folder sharing removal

## Description

The composer's Liitä popover (`web/src/components/composer/AttachmentMenu.tsx`: `.ah-attachment-popover`, `.ah-attachment-dialog`, `.ah-attachment-close`, `.ah-attachment-choices`) has no CSS rules in production. They lived in `web/src/components/LocalFolder.css`, which 22c53a9b ("remove browser folder sharing end to end") deleted together with the folder panel. `grep -rn attachment-popover web/src --include=*.css` finds nothing on main (eac5eec6).

Effect: the popover renders with no surface background, border, width or padding, so the *Tiedosto liitteenä…* choice floats transparently over the conversation.

Fix: move the five surviving rules (the removed file's `.ah-attachment-popover` … `.ah-attachment-choices p`, minus `.ah-local-folder`) into `composer.css` or `components.css`; add a story or visual check for the open menu.

Observed while building the prototype round of `proto-cloud-folder-bridge`, which restores these rules in its own round.css.
