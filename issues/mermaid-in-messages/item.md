---
created: 2026-10-26
updated: 2026-10-26
type: feature
reporter: jari
status: done
priority: normal
closed: 2026-10-26
---

# Render Mermaid diagrams in conversation messages

## Description

Jari, 2026-10-26: it would be nice if the agent could show graphs directly in
conversation messages. A ```` ```mermaid ```` fence in a message is drawn as a
diagram instead of a code block.

## Decisions

- Mermaid is a new, large browser dependency, approved by Jari 2026-10-26. It
  is loaded with a dynamic import only when a message contains a diagram.
- The rendered SVG is shown through `<img>` from a blob URL, never inserted
  into the document. Diagram source comes from untrusted host content; an image
  cannot run script or reach the page even if Mermaid's own sanitizing fails.
  `securityLevel: "strict"` is set as well.
- A fence is drawn only once complete, so a streaming answer does not flash
  parse errors. A failed render falls back to the ordinary code block.

## Acceptance Criteria

- [x] A complete mermaid fence in an agent reply or the person's message shows as a diagram.
- [x] An incomplete or invalid fence shows the existing code block.
- [x] The source remains reachable (copyable) from the diagram.
- [x] Mermaid is not in the initial bundle.
- [x] The diagram follows the light/dark theme.

## Tests Run

- `npx vitest run src/components/MermaidDiagram.test.tsx` and `./scripts/test-focused.sh --area web` (774 passed).
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag mermaid`: real Mermaid in Chromium through the production build and synthetic host; the diagram image decodes, no Mermaid SVG stays in the page, and the Mermaid chunk is fetched only after the reply.
- Production build compared with the previous commit: the initial `index` bundle and its preloads are byte-for-byte the same size; Mermaid is split into lazy chunks.
