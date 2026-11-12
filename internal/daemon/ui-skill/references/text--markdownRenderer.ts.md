# text/markdownRenderer.ts

Generated from web/src/text/markdownRenderer.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Rendered Markdown in a reply (components/MarkdownRenderer.tsx) and its
// diagrams (components/MermaidDiagram.tsx).
const fi = {
  copyCode: "Kopioi koodi",
  showSource: "Näytä Markdown-lähde",
  showPreview: "Näytä esikatselu",
  showAll: "Näytä kaikki",
  showLess: "Näytä vähemmän",
  openInEditor: (path: string) => `Avaa editorissa: ${path}`,
  openAttachment: (name: string) => `Avaa liite ${name}`,
  attachment: "Liite",
  lines: (from: number, to: number) => `, rivit ${from}–${to}`,
  line: (n: number) => `, rivi ${n}`,
  diagram: "Kaavio",
  diagramSource: "Kaavion lähde",
  frontmatter: "Metatiedot",
  table: "Taulukko",
};

export const markdownRendererText = catalog(fi, {
  copyCode: "Copy code",
  showSource: "Show Markdown source",
  showPreview: "Show preview",
  showAll: "Show all",
  showLess: "Show less",
  openInEditor: (path) => `Open in the editor: ${path}`,
  openAttachment: (name) => `Open attachment ${name}`,
  attachment: "Attachment",
  lines: (from, to) => `, lines ${from}–${to}`,
  line: (n) => `, line ${n}`,
  diagram: "Diagram",
  diagramSource: "Diagram source",
  frontmatter: "Metadata",
  table: "Table",
});

```
