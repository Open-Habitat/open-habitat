import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FileToolCard, fileStat } from "./FileToolCard";

it("shows file counts and copies the full read/write content", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const args = JSON.stringify({ path: "src/app.ts", content: "hello\nworld" });

  render(<FileToolCard name="write" argumentsText={args} />);

  fireEvent.click(screen.getByRole("button"));
  expect(writeText).toHaveBeenCalledWith("hello\nworld");
});
it("separates Pi read continuation notices from the file and skips failed results", () => {
  const output =
    "line 1\nline 2\n\n[Showing lines 1-2 of 5. Use offset=3 to continue.]";

  const view = render(
    <FileToolCard name="read" argumentsText="{}" output={output} />,
  );
  expect(screen.getByRole("note").textContent).toContain("Use offset=3");
  expect(
    view.container.querySelector(".ah-output-box")?.textContent,
  ).not.toContain("Use offset=3");
  view.rerender(
    <FileToolCard
      name="read"
      argumentsText="{}"
      output="ENOENT: missing"
      failed
    />,
  );
  expect(fileStat("read", "{}", "ENOENT: missing", true)).toBeUndefined();
  expect(screen.getByText("ENOENT: missing")).toBeTruthy();
  expect(view.container.querySelector(".ah-output-box")).toBeNull();
});
it("renders Pi's edits array and sums multiple replacements", () => {
  const args = JSON.stringify({
    path: "example.ts",
    edits: [
      { oldText: "const x = 2;", newText: "const x = 3;" },
      { oldText: "const y = old;", newText: "const y = new;" },
    ],
  });
  expect(
    fileStat("edit", args, "Successfully replaced 2 block(s) in example.ts."),
  ).toBe("+2 −2");
  const { container } = render(
    <FileToolCard
      name="edit"
      argumentsText={args}
      output="Successfully replaced 2 block(s) in example.ts."
    />,
  );
  expect(
    Array.from(container.querySelectorAll("del"), (n) => n.textContent),
  ).toEqual(["2", "old"]);
  expect(
    Array.from(container.querySelectorAll("ins"), (n) => n.textContent),
  ).toEqual(["3", "new"]);
  expect(screen.getByRole("button")).toBeTruthy();
});
it("uses Pi's native unified diff when present, even without replacement arguments", () => {
  const output =
    "--- a/example.ts\n+++ b/example.ts\n@@ -1 +1 @@\n-const count = 2;\n+const count = 3;";
  expect(fileStat("edit", "", output)).toBe("+1 −1");
  const { container } = render(
    <FileToolCard name="edit" argumentsText="" output={output} />,
  );
  expect(container.querySelector("del")?.textContent).toBe("2");
  expect(container.querySelector("ins")?.textContent).toBe("3");
  expect(screen.getByRole("button")).toBeTruthy();
});
it("pairs changed edit lines and marks changed words, with accessible line labels", () => {
  const args = JSON.stringify({
    path: "app.ts",
    oldText: "const name = old;\nkeep",
    newText: "const name = new;\nkeep",
  });
  expect(fileStat("edit", args)).toBe("+1 −1");
  const { container } = render(
    <FileToolCard name="edit" argumentsText={args} />,
  );
  expect(container.querySelector("del")?.textContent).toBe("old");
  expect(container.querySelector("ins")?.textContent).toBe("new");

  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  fireEvent.click(screen.getByRole("button"));
  expect(writeText).toHaveBeenCalledWith("const name = new;\nkeep");
});
