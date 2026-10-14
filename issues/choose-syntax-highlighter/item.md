---
created: 2026-10-14
updated: 2026-10-14
type: task
reporter: jari
status: open
priority: normal
lane: unlaned
---

# Choose a syntax-highlighting component for code blocks

Jari, pilot.59 (2026-10-14): code blocks in answers, outputs and file cards need syntax highlighting for text, python, rust, json, yaml, shell, markdown, typescript/javascript, go, html/css, toml, diff and similar.

Decide the highlighting component rather than building one. Candidates include Shiki (TextMate grammars, fine-grained bundles, themeable via CSS variables), highlight.js (small core and per-language imports), Prism, and Lezer/CodeMirror language packages. Weigh:
- bundle size, and lazy loading per language;
- a theme driven by our design tokens (light and dark);
- streaming and partial blocks (re-highlighting cost while a block grows);
- no network or CDN at runtime (CSP);
- licence and maintenance;
- quality for the listed languages;
- language detection when the fence has no tag;
- interaction with the existing diff/edit word highlighting in file cards.

The result is an ADR under `docs/decisions/` with a recommendation for Jari to approve. Implementation is a later issue.

## Acceptance Criteria

- [ ] The ADR compares the candidates on the criteria above, with measured bundle sizes for the listed language set.
- [ ] A recommendation with a small spike (a branch-local or throwaway measurement), not merged into the product.
