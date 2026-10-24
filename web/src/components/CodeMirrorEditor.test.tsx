import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import CodeMirrorEditor from "./CodeMirrorEditor";
import { type EditorMergeApi, threeWay } from "./editorMerge";

afterEach(cleanup);

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

it("keeps a conflict open through a later import, and resolves it against the line as it is now", async () => {
  const { api } = await engine("a\nMINE\nc");
  await act(async () =>
    api.bring(threeWay("a\nMINE\nc", "a\nb\nc", "a\nDISK\nc"), "agent"),
  );
  // The conflicted line changes again before the person chooses.
  await act(async () =>
    api.bring(threeWay("a\nMINE\nc", "a\nMINE\nc", "a\nMINE more\nc"), "disk"),
  );
  expect(api.text()).toBe("a\nMINE more\nc");
  // The earlier conflict is still open and still names the agent's line.
  expect(api.merge().conflicts.map((c) => c.theirs)).toEqual([["DISK"]]);
  await pick("pick-both");
  expect(api.text()).toBe("a\nMINE more\nDISK\nc");
  act(() => api.undo());
  await pick("pick-mine");
  expect(api.text()).toBe("a\nMINE more\nc");
  expect(api.merge().conflicts).toHaveLength(0);
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
