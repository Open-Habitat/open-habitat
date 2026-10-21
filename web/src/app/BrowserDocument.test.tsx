import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef, useLayoutEffect } from "react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
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
it.each(["codemirror6", "monaco"] as const)(
  "%s allows correction after locally invalid text without a meaningless remote reconciliation",
  async (engine) => {
    const ref = createRef<BrowserDocumentHandle>();
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <BrowserDocument
            engine={engine}
            workspace="ws_example123"
            csrf="synthetic"
            ref={ref}
          />
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
  },
);

it.each(["codemirror6", "monaco"] as const)(
  "%s keeps observations quiet and scopes discard permission to the committed route layout",
  async (engine) => {
    const ref = createRef<BrowserDocumentHandle>();
    const retentionAtCommit = new Map<string, boolean>();
    function Frame() {
      const location = useLocation();
      useLayoutEffect(() => {
        retentionAtCommit.set(location.key, ref.current?.retains() ?? false);
      }, [location.key]);
      return (
        <BrowserDocument
          engine={engine}
          workspace="ws_example123"
          csrf="synthetic"
          ref={ref}
        />
      );
    }
    const router = createMemoryRouter([{ path: "*", element: <Frame /> }], {
      initialEntries: ["/one"],
    });
    render(<RouterProvider router={router} />);
    await act(async () => {
      await ref.current?.open({ path: "text.txt" });
    });
    act(() => model.onChange("dirty text"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(ref.current?.retains()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => {
      await router.navigate("/two");
    });
    expect(router.state.location.pathname).toBe("/one");
    expect(ref.current?.retains()).toBe(true);
    expect(model.dirty).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    await act(async () => {
      await router.navigate("/two");
    });
    expect(router.state.location.pathname).toBe("/two");
    expect(retentionAtCommit.get(router.state.location.key)).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2);
    // If no resource rebind happened in that commit, later observations cannot
    // reuse permission to discard the still-visible dirty document.
    expect(ref.current?.retains()).toBe(true);
    act(() => model.onChange("new dirty text"));
    expect(ref.current?.retains()).toBe(true);
    confirm.mockRestore();
  },
);
