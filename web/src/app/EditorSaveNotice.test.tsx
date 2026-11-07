import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorSaveNotice } from "./EditorSaveNotice";
import type { EditorDocument } from "./editorFiles";
import { readEditorFile, saveEditorFile } from "./editorFiles";

vi.mock("./editorFiles", async (original) => ({
  ...(await original<typeof import("./editorFiles")>()),
  readEditorFile: vi.fn(),
  saveEditorFile: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const doc = (content: string, v: string): EditorDocument => ({
  schema_version: 1,
  workspace_id: "ws_example123",
  path: "docs/asennus.md",
  content,
  version: `sha256:v1:${v.repeat(64)}`,
  bom: false,
  newline: "lf",
  encoding: "utf-8",
  size_bytes: content.length,
  mode: 384,
});
const save = { before: doc("vanha\n", "a"), after: doc("uusi\n", "b") };

it("writes the earlier version back on the saved version", async () => {
  vi.mocked(saveEditorFile).mockResolvedValueOnce({
    kind: "ok",
    document: doc("vanha\n", "c"),
  });
  render(<EditorSaveNotice save={save} csrf="synthetic" onClose={() => {}} />);
  expect(screen.getByTestId("archive-notice").textContent).toContain(
    "Tallennettu asennus.md",
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId("restore-notice"));
  });
  expect(saveEditorFile).toHaveBeenCalledWith(
    expect.objectContaining({ version: save.after.version, newline: "lf" }),
    "vanha\n",
    "synthetic",
  );
  expect(screen.getByTestId("archive-notice").textContent).toContain(
    "Tallennus kumottu: asennus.md on taas ennallaan.",
  );
  expect(screen.queryByTestId("restore-notice")).toBeNull();
});

it("refuses when the file changed after the save", async () => {
  vi.mocked(saveEditorFile).mockResolvedValueOnce({
    kind: "refused",
    status: 409,
    code: "file_changed",
  });
  render(<EditorSaveNotice save={save} csrf="synthetic" onClose={() => {}} />);
  await act(async () => {
    fireEvent.click(screen.getByTestId("restore-notice"));
  });
  expect(screen.getByTestId("archive-error").textContent).toContain(
    "Tiedosto on muuttunut tallennuksen jälkeen",
  );
  expect(screen.queryByTestId("restore-notice")).toBeNull();
});

it("settles an uncertain undo by reading the file, never by writing again", async () => {
  vi.mocked(saveEditorFile).mockResolvedValueOnce({ kind: "uncertain" });
  vi.mocked(readEditorFile).mockResolvedValueOnce(doc("vanha\n", "c"));
  render(<EditorSaveNotice save={save} csrf="synthetic" onClose={() => {}} />);
  await act(async () => {
    fireEvent.click(screen.getByTestId("restore-notice"));
  });
  expect(saveEditorFile).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("archive-notice").textContent).toContain(
    "Tallennus kumottu",
  );
});
