import { describe, expect, it } from "vitest";
import { fileView } from "./editorPreview";
import { preparePreviewInput } from "./previewInput";
import { choosePreviewRenderer } from "./previewRegistry";

describe("preview frame selection and input", () => {
  it("matches only the exact workspace-root path, never offered copies or content", () => {
    expect(
      choosePreviewRenderer({
        root: "workspace",
        path: ".agents/start-page.md",
      })?.id,
    ).toBe("start-page");
    for (const path of [
      "docs/.agents/start-page.md",
      "start-page.md",
      "./.agents/start-page.md",
      "/.agents/start-page.md",
      ".agents/START-page.md",
      "a/../.agents/start-page.md",
    ])
      expect(
        choosePreviewRenderer({ root: "workspace", path }),
      ).toBeUndefined();
    for (const root of ["offer", "none"] as const)
      expect(
        choosePreviewRenderer({ root, path: ".agents/start-page.md" }),
      ).toBeUndefined();
  });
  it("prepares Markdown metadata and body, or the whole YAML/JSON document", () => {
    const input = (path: string, text: string) =>
      preparePreviewInput({ root: "workspace", path }, text);
    const md = input("note.md", "---\ntitle: Example\n---\n# Body");
    expect(md.body).toBe("# Body");
    expect(md.data).toEqual({
      ok: true,
      value: new Map([["title", "Example"]]),
    });
    expect(input("note.md", "plain").data).toBeNull();
    const yaml = input("data.yml", "title: Example");
    expect(yaml.data).toEqual(md.data);
    expect(yaml.body).toBe("");
    const json = input("data.json", '{"title":"Example"}');
    expect(json.data).toEqual(md.data);
    expect(json.body).toBe("");
    expect(input("data.json", "title: Example").data).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(fileView("data.json")?.kind).toBe("yaml");
    expect(input("data.json", '{"__proto__":{"safe":true}}').data).toEqual({
      ok: true,
      value: new Map([["__proto__", new Map([["safe", true]])]]),
    });
  });
});
