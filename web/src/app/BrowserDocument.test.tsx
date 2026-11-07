import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef, StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import type { BrowserEditorProps } from "../components/BrowserEditor";
import type { EditorMergeApi, MergeState } from "../components/editorMerge";
import BrowserDocument, {
  type BrowserDocumentHandle,
  type LeaveSave,
} from "./BrowserDocument";
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

const conversation = (id: string) =>
  `/workspaces/ws_example123?conversation=pi:${id}`;
async function openOnRoute() {
  const ref = createRef<BrowserDocumentHandle>();
  const left: LeaveSave[] = [];
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <BrowserDocument
            workspace="ws_example123"
            csrf="synthetic"
            ref={ref}
            onLeaveSaved={(save) => left.push(save)}
          />
        ),
      },
    ],
    { initialEntries: [conversation("a")] },
  );
  render(<RouterProvider router={router} />);
  await act(async () => {
    await ref.current?.open({ path: "text.txt" });
  });
  return { ref, router, left };
}

it("keeps the text unsaved across conversations and saves it before a route that unmounts the editor", async () => {
  const { ref, router, left } = await openOnRoute();
  act(() => change("dirty text"));
  const confirm = vi.spyOn(window, "confirm");
  expect(ref.current?.retains()).toBe(true);
  // Another conversation keeps the editor: nothing is asked or written.
  await act(async () => {
    await router.navigate(conversation("b"));
  });
  expect(router.state.location.search).toBe("?conversation=pi:b");
  expect(model.dirty).toBe(true);
  expect(saveEditorFile).not.toHaveBeenCalled();
  const after: EditorDocument = {
    schema_version: 1,
    workspace_id: "ws_example123",
    path: "text.txt",
    content: "dirty text",
    version: `sha256:v1:${"b".repeat(64)}`,
    bom: false,
    newline: "none",
    encoding: "utf-8",
    size_bytes: 10,
    mode: 384,
  };
  vi.mocked(saveEditorFile).mockResolvedValueOnce({
    kind: "ok",
    document: after,
  });
  await act(async () => {
    await router.navigate("/workspaces");
  });
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/workspaces"),
  );
  expect(saveEditorFile).toHaveBeenCalledWith(
    expect.objectContaining({ content: "base" }),
    "dirty text",
    "synthetic",
  );
  expect(left).toEqual([
    {
      before: expect.objectContaining({ content: "base" }),
      after: expect.objectContaining({ version: after.version }),
    },
  ]);
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

it("opening another file saves the current text after the new one was read", async () => {
  const { ref, left } = await openOnRoute();
  act(() => change("dirty text"));
  vi.mocked(saveEditorFile).mockImplementationOnce(async (doc, content) => ({
    kind: "ok",
    document: { ...doc, content, version: `sha256:v1:${"b".repeat(64)}` },
  }));
  await act(async () => {
    expect(await ref.current?.open({ path: "text.txt" })).toBe(true);
  });
  expect(saveEditorFile).toHaveBeenCalledTimes(1);
  expect(left).toHaveLength(1);
  expect(model.dirty).toBe(false);
});

it("asks with Habitat's own window only when the save on leaving fails", async () => {
  const { router, left } = await openOnRoute();
  act(() => change("dirty text"));
  vi.mocked(saveEditorFile).mockResolvedValue({
    kind: "refused",
    status: 403,
    code: "file_denied",
  });
  await act(async () => {
    await router.navigate("/workspaces");
  });
  await screen.findByTestId("unsaved-dialog");
  expect(screen.getByRole("alertdialog").textContent).toContain(
    "Tallennus ei onnistunut. Oma teksti säilyy.",
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId("unsaved-keep"));
  });
  await waitFor(() =>
    expect(screen.queryByTestId("unsaved-dialog")).toBeNull(),
  );
  expect(router.state.location.pathname).toBe("/workspaces/ws_example123");
  expect(model.dirty).toBe(true);
  await act(async () => {
    await router.navigate("/workspaces");
  });
  await act(async () => {
    fireEvent.click(await screen.findByTestId("unsaved-discard"));
  });
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/workspaces"),
  );
  expect(left).toEqual([]);
  vi.mocked(saveEditorFile).mockReset();
});

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
    vi.mocked(readEditorFile).mockRejectedValueOnce(
      new EditorReadError("unsupported"),
    );
    await act(async () => {
      expect(await ref.current?.open({ path: "image.png" })).toBe(false);
    });
    expect(model.document?.path).toBe("text.txt");
    expect(model.dirty).toBe(true);
    // A file that cannot be opened is no reason to write the current one.
    expect(saveEditorFile).not.toHaveBeenCalled();
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
  act(() => {
    // Leave this read pending while the other directory completes.
    void model.onLoadDirectory("a");
  });
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

it("keeps a newer disk version waiting while a conflict is open", async () => {
  const { ref, type, text } = await openWithEngine();
  type("one\ntwo mine\nthree");
  vi.mocked(readEditorFile).mockResolvedValueOnce(
    file("one\ntwo disk\nthree", "b"),
  );
  await act(async () => model.onSave());
  expect(model.changes).toMatchObject({ kind: "imported", conflicts: 1 });
  vi.mocked(readEditorFile).mockResolvedValueOnce(
    file("one\ntwo disk\nthree\nfour", "c"),
  );
  await act(async () => {
    ref.current?.observe({
      workspace: "ws_example123",
      conversation: "conv_example",
      tool: "edit",
      path: "notes.md",
    });
  });
  act(() => model.onImportNow());
  await act(async () => model.onSave());
  // Neither the import nor a write happened behind the open conflict.
  expect(text()).toBe("one\ntwo mine\nthree");
  expect(model.changes).toMatchObject({ kind: "imported", conflicts: 1 });
  expect(saveEditorFile).not.toHaveBeenCalled();
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
