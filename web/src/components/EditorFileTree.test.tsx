import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorFileTree } from "./EditorFileTree";

// A native writer need not belong to the conversation's tool journal.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("refreshes displayed branches, pauses hidden trees and resumes on return", () => {
  vi.useFakeTimers();
  const load = vi.fn();
  const props = {
    visible: true,
    dirty: false,
    directories: {
      "": { entries: [{ name: "src", kind: "directory" as const }] },
      src: { entries: [{ name: "main.ts", kind: "file" as const }] },
    },
    onLoad: load,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(<EditorFileTree {...props} />);
  expect(load.mock.calls).toEqual([["", true]]);
  fireEvent.click(view.getByRole("treeitem"));
  load.mockClear();
  act(() => vi.advanceTimersByTime(3000));
  expect(load.mock.calls).toEqual([
    ["", true],
    ["src", true],
  ]);
  fireEvent.click(view.getAllByRole("treeitem")[0]);
  load.mockClear();
  act(() => vi.advanceTimersByTime(3000));
  expect(load.mock.calls).toEqual([["", true]]);

  view.rerender(<EditorFileTree {...props} visible={false} />);
  load.mockClear();
  act(() => vi.advanceTimersByTime(9000));
  fireEvent.focus(window);
  expect(load).not.toHaveBeenCalled();
  view.rerender(<EditorFileTree {...props} />);
  expect(load.mock.calls).toEqual([["", true]]);
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  load.mockClear();
  act(() => vi.advanceTimersByTime(6000));
  expect(load).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(load.mock.calls).toEqual([["", true]]);
  view.unmount();
  load.mockClear();
  act(() => vi.advanceTimersByTime(6000));
  fireEvent.focus(window);
  expect(load).not.toHaveBeenCalled();
});
