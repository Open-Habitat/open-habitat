# Result: design for registering special preview renderers

The design is in `design.md`: what the four preview surfaces do today, the
selection and registration options, the renderer contract, three Mermaid
diagrams and five questions for Jari. Nothing is implemented and no
production code changed.

Recommendation in one sentence: a static registry in the web bundle,
selection by path from a known root (the start page only in the editor, at
`.agents/start-page.md`), validity from the person's daemon through a new
check route, fallback to the generic preview with the reason, and no
repository-provided renderer code in the app origin.

## Decisions for later review

- **Selection follows the product's own identification rule.** Chosen:
  path only, because the daemon reads the start page from one path.
  Alternatives: a front matter discriminator, content sniffing, a
  workspace-declared mapping. They are described and deferred or rejected
  in the design, section 2.
- **A failed special read does not try another special renderer.** Chosen
  for predictability; the alternative is to continue down the registry.
- **The switch between special and generic view is not remembered.**
  Alternative: remember per file or per person, which would need a store.
- **Other tools' formats get no special renderer.** Alternative: draw
  issue files and release contracts as their tools mean them.
- **The check route is recommended, not decided**: it is a daemon and
  contract change and is question 1 for Jari.

## Review

Focused self-review against the code: every statement in section 1 was
checked against the named file (`editorPreview.ts`, `MarkdownRenderer.tsx`,
`frontmatter.ts`, `AttachmentPreview.tsx`, `OfferPanel.tsx`,
`DocumentPreview.tsx`, `MermaidDiagram.tsx`, `app/attachments.ts`,
`start_page_linux.go`, `workspace_icon_linux.go`, `skill_linux.go`, ADR
0032, `web/AGENTS.md`).

Live check: nothing on the test server, because this is a design document.
Jari reads `issues/preview-renderer-registry/design.md` in the editor's
preview, where the three Mermaid diagrams render, and answers the five
questions in its section 7.
