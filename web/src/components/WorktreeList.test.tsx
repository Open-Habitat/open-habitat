import { fireEvent, render, screen } from "@testing-library/react";
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
      screen.getByRole("button", { name: "Poista wt-done…" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Tallenna ja poista wt-edit…",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Poista pakolla wt-edit…" }),
    ).toBeTruthy();
    // A worktree a live Taskfleet run owns has no action, only the reason.
    expect(screen.queryByRole("button", { name: /wt-run/ })).toBeNull();
    expect(screen.getByText(/omistaa tämän worktreen/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Siivoa merkintä wt-gone" }),
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
    const button = screen.getByRole("button", { name: "Poista pakolla" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("dialog").textContent).toContain(
      "2 muutettua tiedostoa",
    );
    fireEvent.change(screen.getByLabelText(/vahvistukseksi/), {
      target: { value: "wt-edi" },
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/vahvistukseksi/), {
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
    expect(screen.getByRole("dialog").textContent).toContain(
      "Gitin ohittamat tiedostot häviävät: node_modules/",
    );
    expect(screen.getByRole("dialog").textContent).toContain(
      "on yhdistetty haaraan main",
    );
  });
});
