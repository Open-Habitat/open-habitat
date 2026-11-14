import { type ReactNode, useEffect, useId, useState } from "react";
import { liveText } from "../i18n";
import { markdownRendererText } from "../text/markdownRenderer";

const txt = liveText(markdownRendererText);

type Diagram = { url: string; width?: number; height?: number };

function currentTheme(): "dark" | "light" {
  const theme = document.documentElement.dataset.theme;
  // Korkea kontrasti has a dark ground too.
  return theme === "dark" || theme === "contrast" ? "dark" : "light";
}

function useDocumentTheme() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// Mermaid configuration is global and its render queue serializes diagrams, so
// each render sets the theme it needs immediately before it is queued.
async function renderSVG(id: string, source: string, theme: "dark" | "light") {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: theme === "dark" ? "dark" : "default",
    // SVG text survives being shown as an image; HTML labels in a
    // foreignObject depend on the image renderer.
    htmlLabels: false,
  });
  if (!(await mermaid.parse(source, { suppressErrors: true }))) return null;
  return (await mermaid.render(id, source)).svg;
}

function intrinsicSize(svg: string) {
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!box) return {};
  return { width: Math.ceil(+box[1]), height: Math.ceil(+box[2]) };
}

/** A complete mermaid fence drawn as a diagram, with its source one click
 * away. The SVG comes from untrusted text, so it is shown as an image, which
 * cannot run script or reach the page, rather than inserted into the DOM.
 * Until the diagram exists, or if it cannot be drawn, `fallback` (the
 * ordinary code block) stands in for it. */
export function MermaidDiagram({
  source,
  complete,
  fallback,
}: {
  source: string;
  complete: boolean;
  fallback: ReactNode;
}) {
  const theme = useDocumentTheme();
  const id = `ah-mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [diagram, setDiagram] = useState<Diagram | null>(null);

  useEffect(() => {
    if (!complete) return;
    let live = true;
    renderSVG(id, source, theme).then(
      (svg) => {
        if (!live) return;
        if (!svg) return setDiagram(null);
        const url = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml" }),
        );
        setDiagram({ url, ...intrinsicSize(svg) });
      },
      () => {
        if (live) setDiagram(null);
      },
    );
    return () => {
      live = false;
    };
  }, [id, source, complete, theme]);

  // A theme change keeps the old image until its replacement is ready.
  useEffect(
    () => () => {
      if (diagram) URL.revokeObjectURL(diagram.url);
    },
    [diagram],
  );

  if (!diagram) return fallback;
  return (
    <figure className="ah-mermaid" data-testid="mermaid-diagram">
      <img
        src={diagram.url}
        alt={txt.diagram}
        width={diagram.width}
        height={diagram.height}
      />
      <details className="ah-mermaid-source">
        <summary>{txt.diagramSource}</summary>
        {fallback}
      </details>
    </figure>
  );
}
