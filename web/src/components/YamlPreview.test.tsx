import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MarkdownRenderer from "./MarkdownRenderer";
import { YamlPreview } from "./YamlPreview";
import { parseYamlPreview } from "./yamlPreview";

afterEach(cleanup);

describe("nested YAML preview", () => {
  it("shows a start page as open cards, chips and a quote, followed by Markdown", () => {
    const { container } = render(
      <MarkdownRenderer
        document
        text={
          "---\ntitle: Example workspace\ngoals:\n  - title: Plan work\n    steps: [Read, Discuss]\n    prompt: |\n      First line\n      Second line\n---\n# Introduction"
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "Introduction" })).toBeTruthy();
    expect(container.querySelector(".ah-yaml-card header")?.textContent).toBe(
      "1Plan work",
    );
    expect(container.querySelectorAll(".ah-yaml-chips li")).toHaveLength(2);
    expect(container.querySelector("blockquote")?.textContent).toBe(
      "First line\nSecond line\n",
    );
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("pre")).toBeNull();
  });
  it("caps indentation after four levels without hiding deeper values", () => {
    const { container } = render(
      <YamlPreview text="a: {b: {c: {d: {e: {f: {g: visible}}}}}}" />,
    );
    const maps = [...container.querySelectorAll(".ah-yaml-map")];
    expect(maps).toHaveLength(7);
    expect(maps.map((m) => m.hasAttribute("data-flat"))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    expect(screen.getByText("visible")).toBeTruthy();
  });
  it("keeps mixed lists, long text and multiline list items readable", () => {
    const long = "A long description ".repeat(50);
    const { container } = render(
      <YamlPreview
        text={`mixed: [word, 42, true, null, {name: object}, [inner]]\nlong: [${JSON.stringify(long)}]\nlines:\n  - |\n    first\n    second`}
      />,
    );
    expect(screen.getByText("object")).toBeTruthy();
    expect(container.textContent).toContain(long.trim());
    expect(container.querySelector("blockquote")?.textContent).toBe(
      "first\nsecond\n",
    );
    expect(container.querySelector("code")?.textContent).toBe("42");
    expect(container.querySelectorAll(".ah-yaml-list").length).toBeGreaterThan(
      1,
    );
  });
  it("names null, empty string, empty maps and empty lists, even in chips", () => {
    render(
      <YamlPreview
        text={'nil: null\ntext: ""\nmap: {}\nlist: []\nchips: ["", ok]'}
      />,
    );
    expect(screen.getAllByText("tyhjä")).toHaveLength(4);
    expect(screen.getByText("ei kohtia")).toBeTruthy();
  });
  it("renders a CI workflow with on as a key and expressions as inert text", () => {
    const { container } = render(
      <YamlPreview
        text={
          // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression.
          'name: Checks\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Test\n        run: |\n          npm ci\n          npm test\n        env:\n          REF: "${{ github.ref }}"'
        }
      />,
    );
    expect(screen.getByText("on")).toBeTruthy();
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression.
    expect(screen.getByText("${{ github.ref }}")).toBeTruthy();
    expect(container.querySelectorAll(".ah-yaml-card")).toHaveLength(2);
    expect(container.querySelector("pre")).toBeNull();
  });
  it("falls back to the exact source with a clear error and document line", () => {
    const raw = "title: ok\nitems: [unclosed";
    render(<MarkdownRenderer document text={`---\n${raw}\n---\nBody`} />);
    expect(screen.getByRole("status").textContent).toMatch(/YAML.*rivillä 3/);
    expect(screen.getByTestId("markdown-frontmatter-raw").textContent).toBe(
      raw,
    );
    expect(screen.getByText("Body")).toBeTruthy();
  });
  it("does not interpret YAML strings as markup or links", () => {
    const { container } = render(
      <YamlPreview
        text={
          'value: "<img src=x onerror=alert(1)>"\nurl: https://example.invalid'
        }
      />,
    );
    expect(container.querySelector("img, a, script")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });
  it("keeps leading rules in messages, without interpreting front matter", () => {
    render(<MarkdownRenderer text="---\nkey: value\n---\nBody" />);
    expect(screen.queryByTestId("markdown-frontmatter")).toBeNull();
  });
});

describe("bounded YAML data", () => {
  it("preserves scalar types, long integers and prototype-like keys", () => {
    const result = parseYamlPreview(
      '__proto__: safe\nconstructor: text\nnumber: 9007199254740993\nyes: yes\n"false": false',
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value instanceof Map) {
      expect(result.value.get("__proto__")).toBe("safe");
      expect(result.value.get("number")).toBe(9007199254740993n);
      expect(result.value.get("yes")).toBe("yes");
    }
  });
  it("supports ordinary aliases", () => {
    expect(parseYamlPreview("a: &shared [one, two]\nb: *shared").ok).toBe(true);
  });
  it.each([
    "a: &a [*a]",
    "a: !custom value",
    "a: 1\na: 2",
    "? [complex, key]\n: value",
    "---\na: one\n---\nb: two",
    `a: ${"[".repeat(110)}x${"]".repeat(110)}`,
    `a: [${Array(5001).fill("x").join(",")}]`,
    "a: &a [x,x,x,x,x,x,x,x,x,x]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]",
  ])("uses source fallback for unsupported or unsafe trees: %.50s", (text) => {
    expect(parseYamlPreview(text).ok).toBe(false);
  });
});
