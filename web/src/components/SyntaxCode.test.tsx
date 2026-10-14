import { render, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { SyntaxCode, safeHighlightedNodes, syntaxLanguage } from "./SyntaxCode";

it("resolves the supported aliases and rejects unknown languages", () => {
  expect(syntaxLanguage("PY")).toBe("python");
  expect(syntaxLanguage("sh")).toBe("bash");
  expect(syntaxLanguage("html")).toBe("xml");
  expect(syntaxLanguage("toml")).toBe("ini");
  expect(syntaxLanguage("tsx")).toBe("typescript");
  expect(syntaxLanguage("not-a-grammar")).toBeUndefined();
});
it("only converts known token spans and falls back if the source does not match", () => {
  const { container, rerender } = render(
    <code>
      {safeHighlightedNodes(
        '<span class="hljs-keyword" onclick="evil()">const</span> &lt;tag&gt;',
        "const <tag>",
      )}
    </code>,
  );
  expect(
    container.querySelector(".hljs-keyword")?.getAttribute("onclick"),
  ).toBeNull();
  expect(container.textContent).toBe("const <tag>");
  rerender(
    <code>
      {safeHighlightedNodes(
        "<img src=x onerror=evil()>",
        "<img src=x onerror=evil()>",
      )}
    </code>,
  );
  expect(container.querySelector("img")).toBeNull();
});
it("keeps partial, unknown and large input as literal text", async () => {
  const hostile = "<script>alert(1)</script>";
  const { container, rerender } = render(
    <SyntaxCode text={hostile} language="nonesuch" />,
  );
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toBe(hostile);
  rerender(
    <SyntaxCode text={"const x = 42;".repeat(3000)} language="javascript" />,
  );
  expect(container.querySelector(".hljs-keyword")).toBeNull();
  rerender(<SyntaxCode text={"const x = 42;".repeat(4)} complete={false} />);
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(container.querySelector(".hljs-keyword")).toBeNull();
});
it("loads a declared grammar and renders inert highlighted source", async () => {
  render(
    <SyntaxCode
      text={'const answer = "<img onerror=evil()>";'}
      language="js"
    />,
  );
  await waitFor(() =>
    expect(document.querySelector(".hljs-keyword")).not.toBeNull(),
  );
  expect(document.querySelector(".ah-syntax")?.textContent).toBe(
    'const answer = "<img onerror=evil()>";',
  );
  expect(document.querySelector("img")).toBeNull();
});
