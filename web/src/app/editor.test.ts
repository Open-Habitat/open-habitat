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
  it("leaves everything that is not a path inside the workspace as text", () => {
    for (const text of [
      "/etc/passwd",
      "~/notes.md",
      "../secret.txt",
      "a/../../b.go",
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
    for (const text of [
      "../src/",
      "src/../private/",
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
