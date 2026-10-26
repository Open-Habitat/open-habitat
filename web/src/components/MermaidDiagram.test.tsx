import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarkdownRenderer from "./MarkdownRenderer";

// jsdom cannot lay out SVG, so Mermaid itself is replaced; the browser suite
// is where a real diagram is drawn.
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));
vi.mock("mermaid", () => ({ default: mermaid }));

// A hostile renderer result: if this ever reached the document, script and
// event handlers inside it would run with the page's authority.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120.5 40"><script>parent.pwned=1</script><g onload="parent.pwned=1"><text>A</text></g></svg>';
const fence = "```mermaid\ngraph TD; A-->B\n```";

beforeEach(() => {
  mermaid.parse.mockResolvedValue({ diagramType: "flowchart" });
  mermaid.render.mockResolvedValue({ svg });
  URL.createObjectURL = vi.fn(() => "blob:diagram");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("mermaid fences", () => {
  it("draws a complete fence as an image and never inserts the SVG", async () => {
    const { container } = render(<MarkdownRenderer text={fence} />);
    const figure = await screen.findByTestId("mermaid-diagram");
    const img = figure.querySelector("img");
    expect(img?.getAttribute("src")).toBe("blob:diagram");
    expect(img?.getAttribute("width")).toBe("121");
    expect(container.querySelector("svg script, script, [onload]")).toBeNull();
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict" }),
    );
    // The source stays available behind the diagram.
    expect(figure.querySelector("details code, details pre")).not.toBeNull();
  });

  it("does not draw an unfinished fence while the answer streams", async () => {
    render(<MarkdownRenderer text={"```mermaid\ngraph TD; A-->"} />);
    await Promise.resolve();
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mermaid-diagram")).toBeNull();
    expect(document.querySelector(".ah-markdown-code")).not.toBeNull();
  });

  it.each([
    ["invalid syntax", () => mermaid.parse.mockResolvedValue(false)],
    ["a render failure", () => mermaid.render.mockRejectedValue(new Error())],
  ])("falls back to the code block on %s", async (_, fail) => {
    fail();
    render(<MarkdownRenderer text={fence} />);
    await waitFor(() => expect(mermaid.parse).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByTestId("mermaid-diagram")).toBeNull();
    expect(document.querySelector(".ah-markdown-code")).not.toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("redraws for the dark theme", async () => {
    render(<MarkdownRenderer text={fence} />);
    await screen.findByTestId("mermaid-diagram");
    document.documentElement.dataset.theme = "dark";
    await waitFor(() =>
      expect(mermaid.initialize).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: "dark" }),
      ),
    );
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:diagram"),
    );
    delete document.documentElement.dataset.theme;
  });
});
