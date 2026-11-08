import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MarkdownRenderer from "./MarkdownRenderer";

const feature = vi.hoisted(() => ({ enabled: false }));
vi.mock("../app/accountPreferences", () => ({
  useExperimentalFeature: () => feature.enabled,
}));
afterEach(() => {
  cleanup();
  feature.enabled = false;
});

it("is opt-in and only offers preview for explicitly labelled Markdown", () => {
  const text = "```md\n# Draft\n```\n\n```js\n# Code\n```\n\n```\n# Plain\n```";
  const view = render(<MarkdownRenderer text={text} />);
  expect(screen.queryByTestId("markdown-preview-toggle")).toBeNull();
  feature.enabled = true;
  view.rerender(<MarkdownRenderer text={`${text}\n`} />);
  expect(screen.getAllByTestId("markdown-preview-toggle")).toHaveLength(1);
  expect(screen.queryByRole("heading")).toBeNull();
});

it("keeps source copying, selection and the toggle mounted across preview and streaming updates", async () => {
  feature.enabled = true;
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const body =
    "# Draft\n\n**Words**\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n";
  const view = render(<MarkdownRenderer text={`\`\`\`markdown\n${body}`} />);
  const toggle = screen.getByTestId("markdown-preview-toggle");
  fireEvent.click(toggle);
  expect(screen.getByRole("heading").textContent).toBe("Draft");
  expect(view.container.querySelector("script")).toBeNull();
  expect(view.container.querySelector('[href^="javascript:"]')).toBeNull();
  fireEvent.click(screen.getByTestId("output-copy"));
  expect(writeText).toHaveBeenCalledWith(body);
  view.rerender(
    <MarkdownRenderer text={`\`\`\`markdown\n${body}\nMore\n\`\`\``} />,
  );
  expect(screen.getByTestId("markdown-preview-toggle")).toBe(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByTestId("markdown-block-preview").textContent).toContain(
    "More",
  );
  fireEvent.click(toggle);
  expect(screen.queryByTestId("markdown-block-preview")).toBeNull();
  expect(view.container.querySelector("pre")?.textContent).toContain("# Draft");
});
