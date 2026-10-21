import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import type { BrowserEditorProps } from "../components/BrowserEditor";
import BrowserDocument, { type BrowserDocumentHandle } from "./BrowserDocument";
import type { EditorDocument } from "./editorFiles";
import { saveEditorFile } from "./editorFiles";
let model: BrowserEditorProps;
vi.mock("../components/BrowserEditor", () => ({
  BrowserEditor: (props: BrowserEditorProps) => {
    model = props;
    return <div />;
  },
}));
vi.mock("./editorFiles", async (original) => ({
  ...(await original<typeof import("./editorFiles")>()),
  listEditorFiles: vi.fn().mockResolvedValue({
    workspace_id: "ws_example123",
    path: "",
    entries: [],
    truncated: false,
  }),
  readEditorFile: vi.fn().mockResolvedValue({
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
  }),
  saveEditorFile: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("allows correction after locally invalid text without a meaningless remote reconciliation", async () => {
  const ref = createRef<BrowserDocumentHandle>();
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <BrowserDocument workspace="ws_example123" csrf="synthetic" ref={ref} />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  await act(async () => {
    await ref.current?.open({ path: "text.txt" });
  });
  await waitFor(() => expect(model.document?.content).toBe("base"));
  vi.mocked(saveEditorFile).mockResolvedValueOnce({ kind: "invalid" });
  act(() => model.onChange("\ud800"));
  await act(async () => {
    model.onSave();
  });
  await waitFor(() => expect(model.saving).toBe(false));
  expect(model.saveBlocked).toBe(false);
  const saved: EditorDocument = {
    schema_version: 1,
    workspace_id: "ws_example123",
    path: "text.txt",
    content: "corrected",
    version: `sha256:v1:${"b".repeat(64)}`,
    bom: false,
    newline: "none",
    encoding: "utf-8",
    size_bytes: 9,
    mode: 384,
  };
  vi.mocked(saveEditorFile).mockResolvedValueOnce({
    kind: "ok",
    document: saved,
  });
  act(() => model.onChange("corrected"));
  await act(async () => {
    model.onSave();
  });
  await waitFor(() => expect(model.dirty).toBe(false));
  expect(saveEditorFile).toHaveBeenCalledTimes(2);
});
