import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readEditorFile,
  saveEditorFile,
  validEditorText,
  type EditorDocument,
} from "./editorFiles";
import { chooseEditor, editorPreference } from "./editorPreference";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});
const document: EditorDocument = {
  schema_version: 1,
  workspace_id: "ws_example123",
  path: "text.txt",
  content: "base",
  version: `sha256:v1:${"a".repeat(64)}`,
  bom: false,
  newline: "none",
  encoding: "utf-8",
  size_bytes: 4,
  mode: 384,
};
const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("editor text and HTTP boundary", () => {
  it("refuses lone surrogates and control encodings before writing, not legitimate replacement characters", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const text of ["\ud800", "\udc00", "\ud800a", "a\r\nb", "a\0b"]) {
      expect(validEditorText(text)).toBe(false);
      expect((await saveEditorFile(document, text, "csrf")).kind).toBe(
        "invalid",
      );
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(validEditorText("😀\ufffd\n")).toBe(true);
  });
  it("rejects wrong identity/resource, unknown fields and unsupported major versions", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const value of [
      { ...document, workspace_id: "ws_other123" },
      { ...document, path: "elsewhere.txt" },
      { ...document, schema_version: 2 },
      { ...document, unexpected: true },
      { ...document, content: "\ud800" },
    ]) {
      fetch.mockResolvedValueOnce(reply(value));
      await expect(
        readEditorFile(document.workspace_id, document.path),
      ).rejects.toThrow();
    }
  });
  it("keeps failed or malformed successful saves uncertain and never retries", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const response of [
      reply({ error: { code: "file_io_failed" } }, 503),
      reply({}),
      reply({ ...document, workspace_id: "ws_other123" }),
    ]) {
      fetch.mockResolvedValueOnce(response);
      expect((await saveEditorFile(document, "changed", "csrf")).kind).toBe(
        "uncertain",
      );
    }
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("caps a streamed reply without trusting content length", async () => {
    let canceled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));
      },
      cancel() {
        canceled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "2",
          },
        }),
      ),
    );
    await expect(
      readEditorFile(document.workspace_id, document.path),
    ).rejects.toThrow();
    expect(canceled).toBe(true);
  });
});
it("uses identity-scoped enum-only preferences and falls back when storage is blocked", () => {
  localStorage.setItem("nah:editor:v1:wid-invalid", "unknown");
  expect(editorPreference("wid-invalid")).toBe("codemirror6");
  chooseEditor("wid-one", "vscode");
  expect(editorPreference("wid-one")).toBe("vscode");
  expect(editorPreference("wid-two")).toBe("codemirror6");
  expect(localStorage.getItem("nah:editor:v1:wid-one")).toBe("vscode");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(editorPreference("wid-blocked")).toBe("codemirror6");
  chooseEditor("wid-blocked", "vscode");
  expect(editorPreference("wid-blocked")).toBe("vscode");
});
