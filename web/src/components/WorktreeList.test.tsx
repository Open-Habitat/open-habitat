import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import listing from "../../../contracts/v1/examples/workspace-worktrees.json";
import type { Worktree } from "../app/workspaceWorktrees";
import { WorktreeList, WorktreeRemoveDialog } from "./WorktreeList";

const rows = listing.worktrees as Worktree[];

describe("worktree list", () => {
  it("offers exactly the removals the host would accept", () => {
    const onAction = vi.fn();
    render(<WorktreeList worktrees={rows} onAction={onAction} />);
    expect(
      within(screen.getByTestId("worktree-row-wt-done")).getByTestId(
        "worktree-remove",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("worktree-row-wt-edit")).getByTestId(
        "worktree-commit",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("worktree-row-wt-edit")).getByTestId(
        "worktree-force",
      ),
    ).toBeTruthy();
    // A worktree a live Taskfleet run owns has no action, only the reason.
    expect(
      within(screen.getByTestId("worktree-row-wt-run")).queryByTestId(
        "worktree-remove",
      ),
    ).toBeNull();

    fireEvent.click(
      within(screen.getByTestId("worktree-row-wt-gone")).getByTestId(
        "worktree-prune",
      ),
    );
    expect(onAction).toHaveBeenCalledWith(rows[3], "prune");
  });

  it("removes by force only after the name is typed", () => {
    const onConfirm = vi.fn();
    render(
      <WorktreeRemoveDialog
        worktree={rows[1]}
        disposal="force"
        busy={false}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    const button = screen.getByTestId("confirm-worktree");
    expect(button.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "wt-edi" },
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "wt-edit" },
    });
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith("wt-edit");
  });

  it("names the ignored files a removal loses", () => {
    render(
      <WorktreeRemoveDialog
        worktree={rows[0]}
        disposal="remove"
        busy={false}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog").textContent).toContain("node_modules/");
  });
});
