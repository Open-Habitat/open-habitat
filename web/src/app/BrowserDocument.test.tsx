import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef, StrictMode, useLayoutEffect } from "react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import type { BrowserEditorProps } from "../components/BrowserEditor";
import type { EditorMergeApi, MergeState } from "../components/editorMerge";
import BrowserDocument, { type BrowserDocumentHandle } from "./BrowserDocument";
import type { EditorDocument } from "./editorFiles";
import {
  EditorReadError,
  listEditorFiles,
  readEditorFile,
  saveEditorFile,
} from "./editorFiles";

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
const quiet: MergeState = {
  source: "disk",
  imported: false,
  count: 0,
  depth: 0,
  incoming: [],
  conflicts: [],
  pending: [],
};
const change = (text: string) =>
  model.onChange(text, { merge: quiet, typed: true, importLatest: false });
it.each(["codemirror6"] as const)(
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
    act(() => change("\ud800"));
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
    act(() => change("corrected"));
    await act(async () => {
      model.onSave();
    });
    await waitFor(() => expect(model.dirty).toBe(false));
    expect(saveEditorFile).toHaveBeenCalledTimes(2);
  },
);

it.each(["codemirror6"] as const)(
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
    act(() => change("dirty text"));
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
    act(() => change("new dirty text"));
    expect(ref.current?.retains()).toBe(true);
    confirm.mockRestore();
  },
);

it.each(["codemirror6"] as const)(
  "%s retains the local document on unsupported reads and refused read-only saves",
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
    act(() => change("unsaved text"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(readEditorFile).mockRejectedValueOnce(
      new EditorReadError("unsupported"),
    );
    await act(async () => {
      expect(await ref.current?.open({ path: "image.png" })).toBe(false);
    });
    expect(model.document?.path).toBe("text.txt");
    expect(model.dirty).toBe(true);
    vi.mocked(saveEditorFile).mockResolvedValueOnce({
      kind: "refused",
      status: 415,
      code: "file_unsupported",
    });
    await act(async () => {
      model.onSave();
    });
    expect(saveEditorFile).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "text.txt" }),
      "unsaved text",
      "synthetic",
    );
    expect(model.dirty).toBe(true);
    expect(model.saving).toBe(false);
    expect(model.document?.path).toBe("text.txt");
    confirm.mockRestore();
  },
);

it("keeps simultaneous directory observations separate and offers retry without disturbing the document", async () => {
  const router = createMemoryRouter([
    {
      path: "/",
      element: <BrowserDocument workspace="ws_example123" csrf="synthetic" />,
    },
  ]);
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  await waitFor(() => expect(model.directories[""]?.entries).toEqual([]));
  let resolveA!: (value: Awaited<ReturnType<typeof listEditorFiles>>) => void;
  vi.mocked(listEditorFiles).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveA = resolve;
      }),
  );
  act(() => model.onLoadDirectory("a"));
  vi.mocked(listEditorFiles).mockResolvedValueOnce({
    workspace_id: "ws_example123",
    path: "b",
    entries: [{ name: "b.txt", kind: "file" }],
    truncated: true,
  });
  await act(async () => model.onLoadDirectory("b"));
  await act(async () =>
    resolveA({
      workspace_id: "ws_example123",
      path: "a",
      entries: [{ name: "a.txt", kind: "file" }],
      truncated: false,
    }),
  );
  expect(model.directories.a.entries?.[0].name).toBe("a.txt");
  expect(model.directories.b.entries?.[0].name).toBe("b.txt");
  expect(model.directories.b.truncated).toBe(true);
  vi.mocked(listEditorFiles).mockRejectedValueOnce(
    new Error("synthetic read failure"),
  );
  await act(async () => model.onLoadDirectory("a"));
  expect(model.directories.a.error).toBe(true);
  expect(model.directories.a.entries?.[0].name).toBe("a.txt");
  vi.mocked(listEditorFiles).mockResolvedValueOnce({
    workspace_id: "ws_example123",
    path: "a",
    entries: [],
    truncated: false,
  });
  await act(async () => model.onLoadDirectory("a"));
  expect(model.directories.a.error).toBeUndefined();
  expect(model.directories.a.entries).toEqual([]);
});

const version = (c: string) => `sha256:v1:${c.repeat(64)}`;
const file = (content: string, v: string): EditorDocument => ({
  schema_version: 1,
  workspace_id: "ws_example123",
  path: "notes.md",
  content,
  version: version(v),
  bom: false,
  newline: "lf",
  encoding: "utf-8",
  size_bytes: content.length,
  mode: 384,
});
/** A stand-in for CodeMirror holding only the text and the merge state. */
async function openWithEngine() {
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
  vi.mocked(readEditorFile).mockResolvedValueOnce(file("one\ntwo\nthree", "a"));
  await act(async () => {
    await ref.current?.open({ path: "notes.md" });
  });
  let text = "one\ntwo\nthree";
  let state = quiet;
  const engine: EditorMergeApi = {
    text: () => text,
    merge: () => state,
    bring(merged, source) {
      text = merged.text;
      state = {
        ...quiet,
        source,
        imported: true,
        count: merged.incoming.length + merged.conflicts.length,
        conflicts: merged.conflicts.map((c, id) => ({
          id,
          from: 0,
          to: 0,
          ...c,
        })),
      };
      model.onChange(text, { merge: state, typed: false, importLatest: true });
    },
    showPending: () => {},
    follow(next) {
      text = next;
      model.onChange(text, { merge: quiet, typed: false, importLatest: false });
    },
    clear: () => {
      state = quiet;
    },
    undo: () => {},
  };
  if (model.mergeApi) model.mergeApi.current = engine;
  const type = (next: string) =>
    act(() => {
      text = next;
      change(next);
    });
  return { ref, type, text: () => text };
}

it("brings a disk change in before saving and writes on the new base", async () => {
  const { type } = await openWithEngine();
  type("one\ntwo mine\nthree");
  const disk = file("one\ntwo\nthree\nfour", "b");
  vi.mocked(readEditorFile).mockResolvedValueOnce(disk);
  vi.mocked(saveEditorFile).mockImplementationOnce(async (doc, content) => ({
    kind: "ok",
    document: { ...doc, content, version: version("c") },
  }));
  await act(async () => model.onSave());
  expect(saveEditorFile).toHaveBeenCalledTimes(1);
  expect(saveEditorFile).toHaveBeenLastCalledWith(
    expect.objectContaining({ version: disk.version }),
    "one\ntwo mine\nthree\nfour",
    "synthetic",
  );
  expect(model.dirty).toBe(false);
  expect(model.notice).toBeTruthy();
});

it("reads again and retries when the daemon refuses a base that changed meanwhile", async () => {
  const { type } = await openWithEngine();
  type("zero\none\ntwo\nthree");
  // The pre-save read still sees the base; the write is refused; the
  // second read sees the newer disk version.
  vi.mocked(readEditorFile)
    .mockResolvedValueOnce(file("one\ntwo\nthree", "a"))
    .mockResolvedValueOnce(file("one\ntwo\nthree!", "b"));
  vi.mocked(saveEditorFile)
    .mockResolvedValueOnce({
      kind: "refused",
      status: 409,
      code: "file_changed",
    })
    .mockImplementationOnce(async (doc, content) => ({
      kind: "ok",
      document: { ...doc, content, version: version("c") },
    }));
  await act(async () => model.onSave());
  expect(saveEditorFile).toHaveBeenCalledTimes(2);
  expect(saveEditorFile).toHaveBeenLastCalledWith(
    expect.objectContaining({ version: version("b") }),
    "zero\none\ntwo\nthree!",
    "synthetic",
  );
  expect(model.problem).toBeUndefined();
});

it("does not write while a conflict waits for the person's choice", async () => {
  const { type } = await openWithEngine();
  type("one\ntwo mine\nthree");
  vi.mocked(readEditorFile).mockResolvedValueOnce(
    file("one\ntwo disk\nthree", "b"),
  );
  await act(async () => model.onSave());
  expect(saveEditorFile).not.toHaveBeenCalled();
  expect(model.changes).toMatchObject({ kind: "imported", conflicts: 1 });
});

it("names the agent only for its file tool on this file and imports on request", async () => {
  const { ref, type, text } = await openWithEngine();
  type("one\ntwo mine\nthree");
  const report = {
    workspace: "ws_example123",
    conversation: "conv_example",
  };
  // Another workspace and a read-only tool are not reasons to read.
  act(() =>
    ref.current?.observe({ ...report, workspace: "ws_other", tool: "bash" }),
  );
  act(() =>
    ref.current?.observe({ ...report, tool: "read", path: "notes.md" }),
  );
  act(() =>
    ref.current?.observe({ ...report, tool: "edit", path: "other.md" }),
  );
  await act(async () => {});
  expect(readEditorFile).toHaveBeenCalledTimes(1);
  vi.mocked(readEditorFile).mockResolvedValueOnce(
    file("one\ntwo\nthree\nfour", "b"),
  );
  await act(async () => {
    ref.current?.observe({ ...report, tool: "bash" });
  });
  await waitFor(() =>
    expect(model.changes).toMatchObject({ kind: "pending", source: "disk" }),
  );
  // The agent's edit of the same version names the agent.
  vi.mocked(readEditorFile).mockResolvedValueOnce(
    file("one\ntwo\nthree\nfour", "b"),
  );
  await act(async () => {
    ref.current?.observe({ ...report, tool: "edit", path: "./notes.md" });
  });
  await waitFor(() =>
    expect(model.changes).toMatchObject({
      kind: "pending",
      source: "agent",
      count: 1,
    }),
  );
  // Waiting changes are not in the text until imported.
  expect(text()).toBe("one\ntwo mine\nthree");
  act(() => model.onImportNow());
  expect(text()).toBe("one\ntwo mine\nthree\nfour");
  expect(model.changes).toMatchObject({ kind: "imported", source: "agent" });
});

it("tells the conversation which agent changes a save replaced", async () => {
  const replacedNotes: unknown[] = [];
  const ref = createRef<BrowserDocumentHandle>();
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <BrowserDocument
          workspace="ws_example123"
          csrf="synthetic"
          ref={ref}
          onReplaced={(note) => replacedNotes.push(note)}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  vi.mocked(readEditorFile).mockResolvedValueOnce(file("one\ntwo", "a"));
  await act(async () => {
    await ref.current?.open({ path: "notes.md" });
  });
  let text = "one\ntwo";
  const engine: EditorMergeApi = {
    text: () => text,
    merge: () => quiet,
    // The person undid the import at once: the text keeps only their line.
    bring: () => {},
    showPending: () => {},
    follow: () => {},
    clear: () => {},
    undo: () => {},
  };
  if (model.mergeApi) model.mergeApi.current = engine;
  act(() => {
    text = "one mine\ntwo";
    change(text);
  });
  vi.mocked(readEditorFile).mockResolvedValueOnce(file("one\ntwo\nthree", "b"));
  await act(async () => {
    ref.current?.observe({
      workspace: "ws_example123",
      conversation: "conv_example",
      tool: "write",
      path: "notes.md",
    });
  });
  await waitFor(() => expect(model.changes?.kind).toBe("pending"));
  act(() => model.onImportNow());
  expect(model.changes).toMatchObject({ kind: "undone", source: "agent" });
  vi.mocked(readEditorFile).mockResolvedValueOnce(file("one\ntwo\nthree", "b"));
  vi.mocked(saveEditorFile).mockImplementationOnce(async (doc, content) => ({
    kind: "ok",
    document: { ...doc, content, version: version("c") },
  }));
  await act(async () => model.onSave());
  expect(replacedNotes).toEqual([
    expect.objectContaining({
      conversation: "conv_example",
      path: "notes.md",
      changes: [{ line: 3, theirs: ["three"] }],
    }),
  ]);
});
