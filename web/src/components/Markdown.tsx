import { lazy, Suspense } from "react";

const Renderer = lazy(() => import("./MarkdownRenderer"));

/** `breaks` keeps every typed newline as a line break, for the person's own
 * messages; agent replies use ordinary Markdown soft breaks. */
export function Markdown({
  text,
  breaks = false,
}: {
  text: string;
  breaks?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="ah-markdown" style={{ whiteSpace: "pre-wrap" }}>
          {text}
        </div>
      }
    >
      <Renderer text={text} breaks={breaks} />
    </Suspense>
  );
}
