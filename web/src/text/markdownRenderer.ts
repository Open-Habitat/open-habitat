import { catalog } from "../i18n";

// Rendered Markdown in a reply (components/MarkdownRenderer.tsx) and its
// diagrams (components/MermaidDiagram.tsx).
const fi = {
  copyCode: "Kopioi koodi",
  openInEditor: (path: string) => `Avaa editorissa: ${path}`,
  openAttachment: (name: string) => `Avaa liite ${name}`,
  attachment: "Liite",
  diagram: "Kaavio",
  diagramSource: "Kaavion lähde",
};

export const markdownRendererText = catalog(fi, {
  copyCode: "Copy code",
  openInEditor: (path) => `Open in the editor: ${path}`,
  openAttachment: (name) => `Open attachment ${name}`,
  attachment: "Attachment",
  diagram: "Diagram",
  diagramSource: "Diagram source",
});
