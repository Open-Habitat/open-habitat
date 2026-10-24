import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileLinkContext } from "./fileRefs";
import MarkdownRenderer from "./MarkdownRenderer";

afterEach(cleanup);

// Representative model reply syntax, not transcripts from the live server.
const samples = [
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
