import { lazy, Suspense } from "react";

const Renderer = lazy(() => import("./MarkdownRenderer"));

export function Markdown({ text }: { text: string }) {
  return (
    <Suspense
      fallback={
        <div className="ah-markdown" style={{ whiteSpace: "pre-wrap" }}>
          {text}
        </div>
      }
    >
      <Renderer text={text} />
    </Suspense>
  );
}
