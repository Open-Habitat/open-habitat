import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import listing from "../../../contracts/v1/examples/workspace-worktrees.json";
import type { Worktree } from "../app/workspaceWorktrees";
import { removedText } from "../app/worktreeText";
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

  it("uses run facts, never the directory spelling, to identify leftovers", () => {
    const w: Worktree = {
      ...rows[0],
      name: "wt-123456-repair-search",
      owner: {
        run_id: "run",
        role: "worker",
        state: "waiting",
        title: "Repair search",
      },
      actions: ["remove"],
      blockers: [],
    };
    const { rerender } = render(
      <WorktreeList worktrees={[w]} onAction={vi.fn()} />,
    );
    expect(screen.getByText(/Worker odottaa päätöstäsi/)).toBeTruthy();
    expect(screen.queryByTestId("worktree-remove")).toBeNull();
    expect(screen.queryByText(/Jäänne/)).toBeNull();
    rerender(
      <WorktreeList
        worktrees={[
          {
            ...w,
            owner: { run_id: "run", role: "ended", state: "ended" },
            blockers: [{ kind: "unknown", check: "worktrees" }],
          },
        ]}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/Päättyneen ajon/)).toBeTruthy();
    expect(screen.getByText(/Pyydä työtilan agenttia/)).toBeTruthy();
    expect(screen.queryByTestId("worktree-remove")).toBeNull();
    rerender(
      <WorktreeList
        worktrees={[{ ...w, owner: undefined }]}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText("repair search")).toBeTruthy();
    expect(screen.queryByText(/Jäänne/)).toBeNull();
    expect(screen.getByTestId("worktree-remove")).toBeTruthy();
  });

  it("keeps an ordinary worktree's spelling and blocks retry after a process refusal", () => {
    const onConfirm = vi.fn();
    render(
      <WorktreeRemoveDialog
        worktree={{ ...rows[0], name: "hotfix-2-1" }}
        disposal="remove"
        busy={false}
        blockers={[{ kind: "process", pid: 42 }]}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("heading").textContent).toContain("hotfix-2-1");
    expect(screen.getByRole("alert").textContent).toContain(
      "Pyydä työtilan agenttia",
    );
    expect(
      screen.getByTestId("confirm-worktree").hasAttribute("disabled"),
    ).toBe(true);
    const form = screen.getByTestId("confirm-worktree").closest("form");
    if (!form) throw new Error("Missing removal form");
    fireEvent.submit(form);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("removes by force only after the name is typed", () => {
    const onConfirm = vi.fn();
    render(
      <WorktreeRemoveDialog
        worktree={{
          ...rows[1],
          owner: {
            run_id: "run",
            role: "ended",
            state: "ended",
            title: "Repair search",
          },
        }}
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
      target: { value: "Repair search" },
    });
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith("wt-edit");
  });

  it("uses the task identity rather than native identifiers in removal feedback", () => {
    const w: Worktree = {
      ...rows[0],
      name: "wt-1234567890-repair-search",
      branch: "wt/1234567890-repair-search",
      owner: {
        run_id: "run",
        role: "ended",
        state: "ended",
        title: "Repair search",
      },
    };
    const notice = removedText(w, {
      schema_version: 1,
      workspace_id: w.workspace_id,
      entry: w.entry,
      state: "removed",
      branch: w.branch,
      branch_kept: "not_merged",
    });
    expect(notice).toContain(w.owner?.title);
    expect(notice).not.toContain(w.name);
    expect(notice).not.toContain(w.branch);
    render(
      <WorktreeRemoveDialog
        worktree={w}
        disposal="remove"
        busy={false}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(w.owner?.title);
    expect(dialog.textContent).not.toContain(w.name);
    expect(dialog.textContent).not.toContain(w.branch);
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
