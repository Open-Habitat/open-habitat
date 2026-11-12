import { lazy, Suspense } from "react";

const Renderer = lazy(() => import("./MarkdownRenderer"));

/** `breaks` keeps every typed newline as a line break, for the person's own
 * messages; agent replies use ordinary Markdown soft breaks. `document` is a
 * Markdown file's preview, whose leading YAML frontmatter is metadata; in a
 * message a leading `---` stays the author's rule. */
export function Markdown({
  text,
  breaks = false,
  document = false,
}: {
  text: string;
  breaks?: boolean;
  document?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="ah-markdown" style={{ whiteSpace: "pre-wrap" }}>
          {text}
        </div>
      }
    >
      <Renderer text={text} breaks={breaks} document={document} />
    </Suspense>
  );
}
