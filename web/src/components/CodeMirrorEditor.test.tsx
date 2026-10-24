import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import CodeMirrorEditor from "./CodeMirrorEditor";
import { type EditorMergeApi, threeWay } from "./editorMerge";

beforeEach(() => {
  // These tests exercise merge state, not layout. Keep CodeMirror's measures
  // from racing the assertions in jsdom, which has no Range geometry API.
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
});

afterEach(async () => {
  try {
    // Unmount destroys each EditorView and cancels its scheduled measures.
    // Flush anything left (including conflict widgets' deferred unmounts)
    // before returning control to jsdom's real animation frames.
    cleanup();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

async function engine(content: string) {
  const api = createRef<EditorMergeApi | undefined>() as {
    current: EditorMergeApi | undefined;
  };
  const onChange = vi.fn();
  render(
    <CodeMirrorEditor
      content={content}
      path="notes.txt"
      onChange={onChange}
      onSave={() => {}}
      mergeApi={api}
    />,
  );
  const current = api.current;
  if (!current) throw new Error("engine did not mount");
  return { api: current, onChange };
}
const pick = async (name: string) => {
  const button = document.querySelector<HTMLElement>(`[data-testid="${name}"]`);
  if (!button) throw new Error(`no ${name}`);
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
};
it("undoes an import that only opened a conflict as its own step", async () => {
  const { api } = await engine("a\nMINE\nc");
  await act(async () =>
    api.bring(threeWay("a\nMINE\nc", "a\nb\nc", "a\nDISK\nc"), "agent"),
  );
  expect(api.merge().conflicts).toHaveLength(1);
  act(() => api.undo());
  expect(api.text()).toBe("a\nMINE\nc");
  expect(api.merge().conflicts).toHaveLength(0);
  expect(api.merge().imported).toBe(false);
});

it("refuses typing into an open conflict but not elsewhere, and keeps the person's lines on Sinun", async () => {
  const { api } = await engine("a\nMINE\nc");
  await act(async () =>
    api.bring(threeWay("a\nMINE\nc", "a\nb\nc", "a\nDISK\nc"), "agent"),
  );
  const editor = document.querySelector<HTMLElement>(".cm-editor");
  const view = editor && EditorView.findFromDOM(editor);
  if (!view) throw new Error("no view");
  const type = (at: number, insert: string) =>
    act(() =>
      view.dispatch({ changes: { from: at, insert }, userEvent: "input.type" }),
    );
  type(6, "!"); // the end of MINE
  type(2, "?"); // the start of MINE
  expect(api.text()).toBe("a\nMINE\nc");
  type(8, "c"); // the next line
  expect(api.text()).toBe("a\nMINE\ncc");
  await pick("pick-both");
  expect(api.text()).toBe("a\nMINE\nDISK\ncc");
  act(() => api.undo());
  expect(api.merge().conflicts).toHaveLength(1);
  await pick("pick-mine");
  expect(api.text()).toBe("a\nMINE\ncc");
  expect(api.merge().conflicts).toHaveLength(0);
  // Once chosen, the line is the person's to edit again.
  type(6, "!");
  expect(api.text()).toBe("a\nMINE!\ncc");
});

it("removes a line the disk deleted and appends a line the disk added at the end", async () => {
  const deleted = await engine("a\nB\nc");
  await act(async () =>
    deleted.api.bring(threeWay("a\nB\nc", "a\nb\nc", "a\nc"), "agent"),
  );
  await pick("pick-theirs");
  expect(deleted.api.text()).toBe("a\nc");
  cleanup();
  const appended = await engine("a");
  await act(async () =>
    appended.api.bring(threeWay("a", "a\nb", "a\nB"), "agent"),
  );
  expect(appended.api.merge().conflicts).toHaveLength(1);
  await pick("pick-theirs");
  expect(appended.api.text()).toBe("a\nB");
});
