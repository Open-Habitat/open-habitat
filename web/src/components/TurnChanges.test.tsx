import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { type ToolStep, turnChanges } from "../app/turnChanges";
import { TurnChanges } from "./TurnChanges";

const t0 = Date.parse("2026-11-11T10:00:00Z");
const steps: ToolStep[] = [
  {
    callId: "r",
    tool: "read",
    args: JSON.stringify({ path: "src/haku.ts" }),
    output: "a\nb\nc\n",
    failed: false,
    at: t0 + 5_000,
  },
  {
    callId: "e1",
    tool: "edit",
    args: JSON.stringify({
      path: "src/haku.ts",
      edits: [{ oldText: "b", newText: "B" }],
    }),
    failed: false,
    at: t0 + 20_000,
  },
  {
    callId: "e2",
    tool: "edit",
    args: JSON.stringify({
      path: "src/haku.ts",
      edits: [{ oldText: "c", newText: "c\nd" }],
    }),
    failed: false,
    at: t0 + 40_000,
  },
  {
    callId: "b",
    tool: "bash",
    args: JSON.stringify({ command: "git rm src/vanha.ts" }),
    failed: false,
    at: t0 + 50_000,
  },
];
const files = turnChanges(steps);

const toggle = () => screen.getByTestId("turn-changes-toggle");

it("opens in place to the files; a file opens its whole change and the editor at its first changed line", () => {
  const onOpen = vi.fn();
  const view = render(
    <TurnChanges files={files} start={t0} end={t0 + 60_000} onOpen={onOpen} />,
  );
  const card = screen.getByTestId("turn-changes");
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByTestId("turn-changes-file")).toBeNull();

  fireEvent.click(toggle());
  const rows = within(card).getAllByTestId("turn-changes-file");
  // In the turn's order, inside the card: the list opens where the line is.
  expect(rows.map((r) => r.closest("li")?.dataset.path)).toEqual([
    "src/haku.ts",
    "src/vanha.ts",
  ]);
  expect(screen.queryByTestId("turn-changes-diff")).toBeNull();

  fireEvent.click(rows[0]);
  const diff = within(card).getByTestId("turn-changes-diff");
  expect(diff.querySelectorAll(".ah-diff-add")).toHaveLength(2);
  expect(diff.querySelectorAll(".ah-diff-remove")).toHaveLength(1);
  fireEvent.click(within(diff).getByTestId("turn-changes-open-editor"));
  expect(onOpen).toHaveBeenCalledWith("src/haku.ts", 2);

  // A deleted file has no editor to open.
  fireEvent.click(rows[1]);
  const deleted = within(card).getAllByTestId("turn-changes-diff")[1];
  expect(within(deleted).queryByTestId("turn-changes-open-editor")).toBeNull();
  view.unmount();
});

it("the timeline replaces the list and a mark opens that one change", () => {
  render(<TurnChanges files={files} start={t0} end={t0 + 60_000} />);
  // From the collapsed line straight to the timeline.
  fireEvent.click(screen.getByTestId("turn-changes-timeline-toggle"));
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(
    screen
      .getByTestId("turn-changes-timeline-toggle")
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.queryByTestId("turn-changes-file")).toBeNull();
  const marks = screen.getAllByTestId("turn-changes-mark");
  expect(marks.map((m) => m.dataset.tool)).toEqual(["edit", "edit", "bash"]);
  // The second edit sits two thirds along a one-minute turn.
  expect(marks[1].style.left).toBe(`${(40 / 60) * 100}%`);
  fireEvent.click(marks[1]);
  const detail = screen.getByTestId("turn-changes-detail");
  expect(detail.querySelectorAll(".ah-diff-add")).toHaveLength(1);
  expect(detail.querySelectorAll(".ah-diff-remove")).toHaveLength(0);
  // Where no editor is offered, no editor button anywhere.
  expect(screen.queryByTestId("turn-changes-open-editor")).toBeNull();

  fireEvent.click(screen.getByTestId("turn-changes-timeline-toggle"));
  expect(screen.getAllByTestId("turn-changes-file")).toHaveLength(2);
});

it("shows nothing for a turn that changed no files", () => {
  const view = render(<TurnChanges files={[]} />);
  expect(view.container.firstChild).toBeNull();
});
