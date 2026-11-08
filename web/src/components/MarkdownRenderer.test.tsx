import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileLinkContext } from "./fileRefs";
import MarkdownRenderer from "./MarkdownRenderer";

afterEach(cleanup);

// Representative model reply syntax, not transcripts from the live server.
const samples = [
  ["See docs/asennus.md.", "docs/asennus.md", { path: "docs/asennus.md" }],
  ["See `notes.txt`.", "notes.txt", { path: "notes.txt" }],
  ["See `./example.com`.", "./example.com", { path: "example.com" }],
  ["See [folder](./src/components/).", "folder", { path: "src/components/" }],
  ["See `src/components/`.", "src/components/", { path: "src/components/" }],
  ["See src/components/.", "src/components/", { path: "src/components/" }],
  [
    "Changed `src/main.ts:42-48`.",
    "src/main.ts:42-48",
    { path: "src/main.ts", line: 42, end: 48 },
  ],
  [
    "See src/main.ts:42:7, then continue.",
    "src/main.ts:42:7",
    { path: "src/main.ts", line: 42 },
  ],
  [
    "See [the entry point](src/main.ts:42).",
    "the entry point",
    { path: "src/main.ts", line: 42 },
  ],
  [
    "See [source](./src/main.ts#L42-L48).",
    "source",
    { path: "src/main.ts", line: 42, end: 48 },
  ],
  [
    "See [legacy](src/main.ts#L42-48).",
    "legacy",
    { path: "src/main.ts", line: 42, end: 48 },
  ],
  [
    "Updated (src/main.ts:42).",
    "src/main.ts:42",
    { path: "src/main.ts", line: 42 },
  ],
] as const;

describe("file links in rendered Markdown", () => {
  it.each([
    ["portal.azure.com", "https://portal.azure.com"],
    ["`shell.azure.com`", "https://shell.azure.com"],
    ["[Entra](entra.microsoft.com)", "https://entra.microsoft.com"],
    [
      "[Entra][site]\n\n[site]: entra.microsoft.com",
      "https://entra.microsoft.com",
    ],
    ["`http://example.com`", "http://example.com"],
    ["[Azure](https://portal.azure.com)", "https://portal.azure.com"],
    [
      "https://example.com/docs/readme.md",
      "https://example.com/docs/readme.md",
    ],
    ["example.fi/docs/readme.md", "https://example.fi/docs/readme.md"],
    ["[`shell.azure.com`](https://example.com)", "https://example.com"],
  ])("opens web addresses outside the editor: %s", (text, href) => {
    for (const editor of [true, false]) {
      const open = vi.fn();
      const { container, unmount } = render(
        <FileLinkContext.Provider value={editor ? { open } : null}>
          <MarkdownRenderer text={text} />
        </FileLinkContext.Provider>,
      );
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe(href);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(container.querySelectorAll("a a, .ah-file-link")).toHaveLength(0);
      fireEvent.click(link);
      expect(open).not.toHaveBeenCalled();
      unmount();
    }
  });
  it.each(samples)("opens the referenced file: %s", (text, label, expected) => {
    const open = vi.fn();
    render(
      <FileLinkContext.Provider value={{ open }}>
        <MarkdownRenderer text={text} />
      </FileLinkContext.Provider>,
    );
    const link = screen.getByRole("link");
    expect(link.textContent).toBe(label);
    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith(expected, expect.any(String));
  });

  it("does not scan code blocks, URLs, absolute/home paths or traversal for file suffixes", () => {
    const open = vi.fn();
    const text =
      "`/home/alice/src/project/src/main.ts:42` ~/src/project/src/main.ts:42 ../other/main.ts:42 /etc/config.json\n\n```ts\nsrc/main.ts:42\n```\n\n[web](https://example.com/src/main.ts#L42) [bad](javascript:alert(1)) [escape](../other/main.ts:42)";
    const { container } = render(
      <FileLinkContext.Provider value={{ open }}>
        <MarkdownRenderer text={text} />
      </FileLinkContext.Provider>,
    );
    expect(container.querySelectorAll(".ah-file-link")).toHaveLength(0);
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe(
      "https://example.com/src/main.ts#L42",
    );
    expect(screen.getByText("bad").getAttribute("href") ?? "").not.toMatch(
      /javascript:/,
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps code labels inside a single anchor and opens the destination, not the label", () => {
    const open = vi.fn();
    const { container } = render(
      <FileLinkContext.Provider value={{ open }}>
        <MarkdownRenderer text="[`src/old.ts:1`](src/main.ts:42) and [`src/main.ts`](https://example.com)" />
      </FileLinkContext.Provider>,
    );
    expect(container.querySelectorAll("a")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("link")[0]);
    expect(open).toHaveBeenCalledWith(
      { path: "src/main.ts", line: 42 },
      expect.any(String),
    );
  });

  it("leaves file references inert without an editor", () => {
    const { container } = render(
      <MarkdownRenderer text="`src/main.ts:42`, src/main.ts:42 and [source](src/main.ts:42), `src/` and [folder](./src/)" />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("and source");
  });
});

// A selection lives on DOM nodes; a re-render must leave those nodes in place.
describe("a rendered reply under a selection", () => {
  it("keeps code blocks, links and inline code while the reply grows", () => {
    const text =
      "See `src/main.ts` and [docs](https://example.com).\n\n```sh\nls\n```\n";
    const ui = (reply: string) => (
      <FileLinkContext.Provider value={{ open: vi.fn() }}>
        <MarkdownRenderer text={reply} />
      </FileLinkContext.Provider>
    );
    const { container, rerender } = render(ui(text));
    const nodes = () =>
      ["figure", "pre", "a[href^='http']", "a[href^='#']"].map((selector) =>
        container.querySelector(selector),
      );
    const before = nodes();
    expect(before.every(Boolean)).toBe(true);
    rerender(ui(`${text}\nLisää tekstiä.`));
    nodes().forEach((node, index) => {
      expect(node).toBe(before[index]);
    });
  });

  it("leaves a selection in a streamed paragraph when more text arrives", () => {
    const start = "Ensimmäinen lause, joka on tarpeeksi pitkä. ".repeat(4);
    const { container, rerender } = render(<MarkdownRenderer text={start} />);
    const first = container.querySelector("p")?.firstChild;
    if (!first) throw new Error("no paragraph text");
    const range = document.createRange();
    range.setStart(first, 2);
    range.setEnd(first, 12);
    const selected = range.toString();
    rerender(<MarkdownRenderer text={`${start}lisää sanoja virrasta`} />);
    expect(container.querySelector("p")?.firstChild).toBe(first);
    expect(range.toString()).toBe(selected);
    expect(container.querySelector("p")?.textContent).toBe(
      `${start}lisää sanoja virrasta`,
    );
  });
});
