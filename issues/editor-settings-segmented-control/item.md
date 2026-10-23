---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: open
priority: normal
preparation: ready
lane: editor-tree
lane_seq: 4
collision: [web/src/components/editor-files]
---

# Settings › Editori: the prototype's segmented control; drop the agents-can-edit notice

## Description

Jari 2026-10-23 on pilot.332: Settings › Editori is still the ugly bare fieldset with radio buttons and long explanatory text ("Valinta tallennetaan omaan asetustiedostoosi palvelimella…", "CodeMirror muokkaa yhtä tekstitiedostoa kerrallaan…"). The prototype round `proto-editor-settings-filetree` round 1 designed a segmented control consistent with the other Settings selectors, and Jari accepted it ("the settings segmented control is not contested"); only the file tree was implemented (`implement-filetree-viivasto`). Implement the round-1 Settings segmented control (CodeMirror 6 / VS Code) from `issues/proto-editor-settings-filetree/` (result.md round 1, production-context/), with at most one short line of help text.

Also remove the editor's notice "Myös agentit voivat muokata tiedostoa. Tallennus tarkistaa muutokset, mutta ei lukitse natiivityökaluja." — Jari: unnecessary. Conflict detection stays; only the permanent notice goes.

## Acceptance Criteria

- [ ] Settings › Editori uses the prototype's segmented control, consistent with the other Settings selectors, desktop/390 px, light/dark, keyboard accessible.
- [ ] The permanent agents-can-edit notice is gone; conflict handling unchanged.
