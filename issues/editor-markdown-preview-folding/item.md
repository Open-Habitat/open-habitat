---
created: 2026-10-27
updated: 2026-10-27
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-27/editor-markdown-preview-folding
lane: editor-md
lane_seq: 1
preparation: ready
closed: 2026-10-27
---

# Editor: Markdown preview and heading folding

## Description

Jari 2026-10-27. Kuten VS Codessa: Markdown-tiedostolle esikatselu (Shift-Cmd-V / Ctrl-Shift-V, ja sivuttainen esikatselu kuten Cmd-K V) sekä otsikoiden kokoaminen ja avaaminen (fold/unfold). Koskee Habitatin omaa CodeMirror-editoria; VS Code (code-server) tekee nämä jo itse, tarkista. Esikatselu käyttää tuotannon Markdown-renderöintiä (Mermaid mukaan lukien), jotta se näyttää samalta kuin keskustelussa.

## Acceptance Criteria

- [ ] Esikatselu avautuu pikanäppäimellä ja painikkeesta, työpöydällä ja puhelimessa
- [ ] Otsikot voi koota ja avata; selaintesti kattaa molemmat
