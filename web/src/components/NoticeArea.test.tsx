import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchiveNotice } from "./ArchiveNotice";
import { NoticeAreaProvider, type NoticeKind, NoticeSlot } from "./NoticeArea";

type Shown = { id: string; kind: NoticeKind; undo?: boolean };

/** Owners as in the app: each keeps its own notice state and clears it on
 * close. `show` adds one, as a new action would. */
function Harness({ initial }: { initial: Shown[] }) {
  const [shown, setShown] = useState(initial);
  return (
    <NoticeAreaProvider>
      <NoticeSlot />
      <main id="main">
        <textarea data-testid="message-input" />
      </main>
      <button
        type="button"
        data-testid="add-archive"
        onClick={() => setShown((s) => [...s, { id: "late", kind: "archive" }])}
      />
      {shown.map((n) => (
        <ArchiveNotice
          key={n.id}
          kind={n.kind}
          title={n.id}
          busy={false}
          onRestore={n.undo === false ? undefined : () => {}}
          onClose={() => setShown((s) => s.filter((o) => o.id !== n.id))}
        />
      ))}
    </NoticeAreaProvider>
  );
}

const rows = () => screen.queryAllByTestId("archive-notice");
const visible = () =>
  rows()
    .filter((row) => !row.hidden)
    .map((row) => row.querySelector("b")?.textContent);

afterEach(() => vi.useRealTimers());

describe("NoticeArea", () => {
  it("replaces an older notice of the same kind and stacks other kinds", () => {
    render(
      <Harness
        initial={[
          { id: "trash", kind: "trash" },
          { id: "first", kind: "archive" },
        ]}
      />,
    );
    expect(rows()).toHaveLength(2);
    fireEvent.click(screen.getByTestId("add-archive"));
    expect(rows().map((r) => r.querySelector("b")?.textContent)).toEqual([
      "late",
      "trash",
    ]);
  });

  it("keeps an undo in front of a notice that only tells, behind +N", () => {
    render(
      <Harness
        initial={[
          { id: "hidden", kind: "workspace-archive" },
          { id: "mode", kind: "mode", undo: false },
        ]}
      />,
    );
    expect(visible()).toEqual(["hidden"]);
    const more = screen.getByTestId("notice-more");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(visible()).toEqual(["hidden", "mode"]);
  });

  it("stops a folded notice's clock until it comes to the front", () => {
    vi.useFakeTimers();
    render(
      <Harness
        initial={[
          { id: "older", kind: "trash" },
          { id: "newer", kind: "archive" },
        ]}
      />,
    );
    act(() => vi.advanceTimersByTime(19_000));
    expect(visible()).toEqual(["newer"]);
    act(() => vi.advanceTimersByTime(1_500));
    // The folded one waited: it has its whole lifetime left.
    expect(visible()).toEqual(["older"]);
    act(() => vi.advanceTimersByTime(19_000));
    expect(visible()).toEqual(["older"]);
    act(() => vi.advanceTimersByTime(1_500));
    expect(rows()).toHaveLength(0);
  });

  it("pauses every notice while the pointer is on the area", () => {
    vi.useFakeTimers();
    render(<Harness initial={[{ id: "only", kind: "archive" }]} />);
    const area = screen.getByTestId("notice-area");
    fireEvent.pointerEnter(area);
    act(() => vi.advanceTimersByTime(60_000));
    expect(rows()).toHaveLength(1);
    fireEvent.pointerLeave(area);
    act(() => vi.advanceTimersByTime(20_500));
    expect(rows()).toHaveLength(0);
  });

  it("closes on Esc only from inside, and hands focus back to the work", () => {
    render(<Harness initial={[{ id: "only", kind: "archive" }]} />);
    const editor = screen.getByTestId("message-input");
    editor.focus();
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(rows()).toHaveLength(1);
    const close = screen.getByTestId("notice-close");
    close.focus();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((run) => {
      run(0);
      return 0;
    });
    fireEvent.keyDown(close, { key: "Escape" });
    expect(rows()).toHaveLength(0);
    expect(document.activeElement).toBe(editor);
  });
});
