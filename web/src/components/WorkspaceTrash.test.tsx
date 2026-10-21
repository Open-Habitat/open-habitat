import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import check from "../../../contracts/v1/examples/workspace-deletion-check.json";
import type { DeletionCheck } from "../app/workspaceTrash";
import {
  type DeletionView,
  TrashList,
  TrashPurgeDialog,
  WorkspaceDeleteDialog,
} from "./WorkspaceTrash";

const blocked = check as DeletionCheck;
const git = {
  state: "observed" as const,
  has_commits: true,
  remote_refs: true,
  changed: 0,
  untracked: 0,
  ignored: 1,
  ignored_paths: [".env"],
  stash: 0,
  unpushed: 0,
  nested_repositories: 0,
  fetched_at: 1_760_000_000,
};
const permanent: DeletionCheck = {
  ...blocked,
  outcome: "permanent",
  blockers: [],
  facts: { ...blocked.facts, git },
};
const trash: DeletionCheck = {
  ...permanent,
  outcome: "trash",
  facts: { ...permanent.facts, git: { ...git, unpushed: 2 } },
};

function show(view: DeletionView) {
  const onConfirm = vi.fn();
  const onRecheck = vi.fn();
  render(
    <MemoryRouter>
      <WorkspaceDeleteDialog
        name="esimerkki"
        remote="owner/esimerkki"
        view={view}
        isOpen
        onClose={() => {}}
        onRecheck={onRecheck}
        onConfirm={onConfirm}
        conversation={(id) => ({
          href: `/agents/${id}`,
          title: "Korjaa testit",
        })}
      />
    </MemoryRouter>,
  );
  return { onConfirm, onRecheck };
}

describe("workspace deletion confirmation", () => {
  it("deletes a clean, pushed clone outright with no Trash alternative", () => {
    const { onConfirm } = show({ state: "checked", check: permanent });

    expect(screen.queryByTestId("trash-workspace")).toBeNull();

    expect(screen.getByText(".env")).toBeTruthy();
    fireEvent.click(screen.getByTestId("purge-workspace"));
    expect(onConfirm).toHaveBeenCalledWith("permanent");
  });

  it("moves anything only here to the Trash and names where it goes", () => {
    const { onConfirm } = show({ state: "checked", check: trash });

    expect(screen.queryByTestId("purge-workspace")).toBeNull();
    fireEvent.click(screen.getByTestId("trash-workspace"));
    expect(onConfirm).toHaveBeenCalledWith("trash");
  });

  it("lists blockers with their remedies and offers only a recheck", () => {
    const { onConfirm, onRecheck } = show({ state: "checked", check: blocked });
    expect(screen.getAllByRole("listitem")).toHaveLength(
      blocked.blockers.length,
    );
    expect(
      screen.getByText("taskfleet run cancel 01m53433zdhmcc9q1spepb30gz"),
    ).toBeTruthy();
    // The blocking conversation is named, and the link opens it.
    expect(screen.getByRole("link").textContent).toContain("Korjaa testit");
    expect(screen.queryByTestId("purge-workspace")).toBeNull();
    expect(screen.queryByTestId("trash-workspace")).toBeNull();
    fireEvent.click(screen.getByTestId("recheck"));
    expect(onRecheck).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("after a refused confirm, asks for a fresh check instead of repeating it", () => {
    show({ state: "checked", check: trash, problem: "Työtila muuttui." });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByTestId("trash-workspace")).toBeNull();
    expect(screen.getByTestId("recheck")).toBeTruthy();
  });
});

describe("Trash rows and permanent deletion", () => {
  it("refuses restore over a taken name and says why", () => {
    const onRestore = vi.fn();
    render(
      <TrashList
        rows={[
          {
            entry: "a.2",
            kind: "workspace",
            name: "a",
            restore: "name_taken",
            size_bytes: 2 * 1024 ** 2,
            size_complete: true,
          },
        ]}
        onRestore={onRestore}
        onPurge={() => {}}
      />,
    );
    const restore = screen.getByTestId("restore-trash");
    expect(restore.hasAttribute("disabled")).toBe(true);
  });

  it("enables permanent deletion only for the exact name", () => {
    const onConfirm = vi.fn();
    render(
      <TrashPurgeDialog
        row={{
          entry: "a.2",
          kind: "workspace",
          name: "a",
          restore: "available",
          facts: { ...trash.facts },
        }}
        busy={false}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    const button = screen.getByTestId("purge-workspace");
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "a.2" } });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith("a");
  });
});
