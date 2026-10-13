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
  expect(fileStat("read", args, "a\nb")).toBe("2 riviä");
  expect(fileStat("write", args)).toBe("uusi · 2 riviä");
  render(<FileToolCard name="write" argumentsText={args} />);
  expect(screen.getByText("typescript")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Kopioi sisältö" }));
  expect(writeText).toHaveBeenCalledWith("hello\nworld");
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
  expect(screen.getByRole("button", { name: "Kopioi diffi" })).toBeTruthy();
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
  expect(screen.getByText(/poistettu:/)).toBeTruthy();
  expect(screen.getByText(/lisätty:/)).toBeTruthy();
});
