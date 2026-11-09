import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ArchivedHelpers,
  useHelperArchiveConfirmation,
} from "./HelperArchiveFlow";
import { readSpinoffs, type Spinoff, type Spinoffs } from "./spinoffs";

vi.mock("./spinoffs", async (original) => ({
  ...(await original<typeof import("./spinoffs")>()),
  readSpinoffs: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const helper: Spinoff = {
  run_id: "01m6r1q934veb852ke10x2r3ac",
  title: "Review",
  state: "unknown",
  summary: "",
  created_at: "",
  branch: "",
  worktree: "",
  source_branch: "main",
  preserved: false,
  resident: {
    name: "reviewer",
    round_state: "waiting",
    rounds: 2,
    landed_round: 2,
  },
};
const reply = (
  availability: Spinoffs["availability"],
  runs: Spinoff[] = [],
): Spinoffs => ({
  schema_version: 1,
  parent_id: "parent",
  availability,
  runs,
  transcripts: [],
});

it("confirms only a complete empty inventory without a question, and serializes pending reads", async () => {
  let finish!: (value: Spinoffs) => void;
  vi.mocked(readSpinoffs).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useHelperArchiveConfirmation("session"));
  let first!: Promise<boolean>;
  act(() => {
    first = result.current.confirm("parent");
  });
  expect(await result.current.confirm("parent")).toBe(false);
  expect(readSpinoffs).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(reply("available"));
    expect(await first).toBe(true);
  });
});

it("cancels an old session's read rather than opening a late confirmation", async () => {
  let finish!: (value: Spinoffs) => void;
  vi.mocked(readSpinoffs).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ binding }) => useHelperArchiveConfirmation(binding),
    { initialProps: { binding: "one" } },
  );
  let request!: Promise<boolean>;
  act(() => {
    request = result.current.confirm("parent");
  });
  const signal = vi.mocked(readSpinoffs).mock.calls[0][2];
  rerender({ binding: "two" });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish(reply("available", [helper]));
    expect(await request).toBe(false);
  });
});

it("keeps partial rows and reads branch details only when opened", async () => {
  vi.mocked(readSpinoffs)
    .mockResolvedValueOnce(reply("partial", [helper]))
    .mockResolvedValueOnce(
      reply("available", [
        { ...helper, branch: "wt/review", worktree: "/synthetic/review" },
      ]),
    );
  render(<ArchivedHelpers agent="parent" />);
  await waitFor(() =>
    expect(screen.getAllByTestId("helper-archive-row")).toHaveLength(1),
  );
  expect(screen.getByRole("status")).toBeTruthy();
  expect(readSpinoffs).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId("helper-archive-branch"));
  await waitFor(() =>
    expect(screen.getByTestId("helper-branch-name").textContent).toBe(
      "wt/review",
    ),
  );
  expect(vi.mocked(readSpinoffs).mock.calls[1][1]).toBe(helper.run_id);
});

it("session replacement resolves a pending confirmation as cancelled", async () => {
  vi.mocked(readSpinoffs).mockResolvedValue(reply("partial", []));
  const { result, rerender } = renderHook(
    ({ binding }) => useHelperArchiveConfirmation(binding),
    { initialProps: { binding: "one" } },
  );
  let request!: Promise<boolean>;
  await act(async () => {
    request = result.current.confirm("parent");
  });
  rerender({ binding: "two" });
  expect(await request).toBe(false);
});

it("a cancel returns focus to the conversation's button after its row remounted", async () => {
  vi.mocked(readSpinoffs).mockResolvedValue(reply("available", [helper]));
  const pressed = document.createElement("button");
  pressed.dataset.archiveAgent = "parent";
  document.body.append(pressed);
  pressed.focus();
  const { result } = renderHook(() => useHelperArchiveConfirmation("session"));
  let request!: Promise<boolean>;
  act(() => {
    request = result.current.confirm("parent");
  });
  const view = render(result.current.dialog);
  await waitFor(() => {
    view.rerender(result.current.dialog);
    expect(screen.getByTestId("helper-archive-confirm")).toBeTruthy();
  });
  // The turn ends meanwhile and the row moves to another rail section.
  pressed.remove();
  const moved = document.createElement("button");
  moved.dataset.archiveAgent = "parent";
  document.body.append(moved);
  fireEvent.click(screen.getByTestId("helper-archive-cancel"));
  expect(await request).toBe(false);
  view.rerender(result.current.dialog);
  await waitFor(() => expect(document.activeElement).toBe(moved));
  moved.remove();
});

it("a cancel waits for the remounted button to become enabled before focusing it", async () => {
  vi.mocked(readSpinoffs).mockResolvedValue(reply("available", [helper]));
  const pressed = document.createElement("button");
  pressed.dataset.archiveAgent = "parent";
  document.body.append(pressed);
  pressed.focus();
  const { result } = renderHook(() => useHelperArchiveConfirmation("session"));
  let request!: Promise<boolean>;
  act(() => {
    request = result.current.confirm("parent");
  });
  const view = render(result.current.dialog);
  await waitFor(() => {
    view.rerender(result.current.dialog);
    expect(screen.getByTestId("helper-archive-confirm")).toBeTruthy();
  });
  // The row remounts while the turn is still settling, so its button is
  // disabled for a moment after the cancel.
  pressed.remove();
  const moved = document.createElement("button");
  moved.dataset.archiveAgent = "parent";
  moved.disabled = true;
  document.body.append(moved);
  fireEvent.click(screen.getByTestId("helper-archive-cancel"));
  expect(await request).toBe(false);
  view.rerender(result.current.dialog);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(document.activeElement).not.toBe(moved);
  moved.disabled = false;
  await waitFor(() => expect(document.activeElement).toBe(moved));
  moved.remove();
});

it("a person who moves on keeps focus where they put it", async () => {
  vi.mocked(readSpinoffs).mockResolvedValue(reply("available", [helper]));
  const pressed = document.createElement("button");
  pressed.dataset.archiveAgent = "parent";
  document.body.append(pressed);
  pressed.focus();
  const { result } = renderHook(() => useHelperArchiveConfirmation("session"));
  let request!: Promise<boolean>;
  act(() => {
    request = result.current.confirm("parent");
  });
  const view = render(result.current.dialog);
  await waitFor(() => {
    view.rerender(result.current.dialog);
    expect(screen.getByTestId("helper-archive-confirm")).toBeTruthy();
  });
  pressed.remove();
  const moved = document.createElement("button");
  moved.dataset.archiveAgent = "parent";
  moved.disabled = true;
  document.body.append(moved);
  fireEvent.click(screen.getByTestId("helper-archive-cancel"));
  expect(await request).toBe(false);
  view.rerender(result.current.dialog);
  await new Promise((resolve) => setTimeout(resolve, 50));
  fireEvent.pointerDown(document.body);
  moved.disabled = false;
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(document.activeElement).not.toBe(moved);
  moved.remove();
});
