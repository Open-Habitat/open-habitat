import { describe, expect, it } from "vitest";
import { parseFileRef } from "../components/fileRefs";
import {
  clampConversationWidth,
  defaultConversationWidth,
  editorFrameMessage,
} from "./editor";

describe("file references in messages", () => {
  it("recognises workspace paths with a line, a range or a column", () => {
    expect(parseFileRef("internal/daemon/snapshot_linux.go:18")).toEqual({
      path: "internal/daemon/snapshot_linux.go",
      line: 18,
    });
    expect(parseFileRef("web/src/QuotaMeter.tsx:35-40")).toEqual({
      path: "web/src/QuotaMeter.tsx",
      line: 35,
      end: 40,
    });
    expect(parseFileRef("./go.mod:3:7")).toEqual({ path: "go.mod", line: 3 });
    expect(parseFileRef("README.md")).toEqual({ path: "README.md" });
  });
  it.each([
    ".agents/skills/create-presentation/SKILL.md",
    ".github/workflows/x.yml",
    ".pi/settings.json",
    "src/.hidden/file.ts",
    ".env.example",
    ".env",
    "config/.env",
  ])("recognises hidden paths and line suffixes: %s", (path) => {
    expect(parseFileRef(path)).toEqual({ path });
    expect(parseFileRef(`./${path}`)).toEqual({ path });
    expect(parseFileRef(`${path}:42`)).toEqual({ path, line: 42 });
    expect(parseFileRef(`${path}:42-48`)).toEqual({ path, line: 42, end: 48 });
  });
  it("leaves everything that is not a path inside the workspace as text", () => {
    for (const text of [
      "/etc/passwd",
      "~/notes.md",
      "../secret.txt",
      "a/../../b.go",
      ".agents/../secret.md",
      "./.agents/../../secret.md:42-48",
      ".agents/./SKILL.md",
      ".agents//SKILL.md",
      ".agents/..",
      ".agents/%2e%2e/secret.md",
      ".agents/\\..\\secret.md",
      "/.agents/SKILL.md",
      "~/.env.example",
      ".env.example:0",
      ".env.example:1-0",
      "https://example.com/a.js",
      "git diff",
      "1.2.3",
      "v1.2",
      "Makefile",
      "e.g.",
    ])
      expect(parseFileRef(text), text).toBeNull();
  });
  it("recognises explicit directories but refuses traversal and non-workspace links", () => {
    expect(parseFileRef("src/components/")).toEqual({
      path: "src/components/",
    });
    expect(parseFileRef("./src/")).toEqual({ path: "src/" });
    expect(parseFileRef(".agents/skills/")).toEqual({
      path: ".agents/skills/",
    });
    expect(parseFileRef("./.pi/")).toEqual({ path: ".pi/" });
    for (const text of [
      "../src/",
      "src/../private/",
      ".agents/../private/",
      "./.agents/../../private/",
      ".agents/./skills/",
      "/src/",
      "~/src/",
      "//host/src/",
      "https://example.com/src/",
      "src/\\private/",
      "src//child/",
      "./",
      "src/:3",
    ])
      expect(parseFileRef(text), text).toBeNull();
  });
  it("drops a range that runs backwards", () => {
    expect(parseFileRef("a.go:9-3")).toEqual({ path: "a.go", line: 9 });
  });
});

describe("the conversation column", () => {
  it("defaults to a third of the window between 440 and 640 px", () => {
    expect(defaultConversationWidth(1366)).toBe(440);
    expect(defaultConversationWidth(1920)).toBe(576);
    expect(defaultConversationWidth(2560)).toBe(640);
  });
  it("always leaves the editor its minimum and the column its own", () => {
    expect(clampConversationWidth(2000, 1366)).toBe(1366 - 560);
    expect(clampConversationWidth(100, 1366)).toBe(320);
    expect(clampConversationWidth(500, 700)).toBe(320);
  });
});

describe("messages from the editor origin", () => {
  it("accepts only the frame page's own vocabulary", () => {
    expect(
      editorFrameMessage({ source: "open-habitat-editor", type: "toggle" }),
    ).toEqual({ type: "toggle" });
    expect(
      editorFrameMessage({
        source: "open-habitat-editor",
        type: "failed",
        reason: "<img src=x>",
      }),
    ).toEqual({ type: "failed", reason: "unknown" });
    for (const data of [
      { source: "open-habitat-editor", type: "token", token: "x" },
      { source: "vscode", type: "toggle" },
      "toggle",
      null,
    ])
      expect(editorFrameMessage(data)).toBeNull();
  });
});
