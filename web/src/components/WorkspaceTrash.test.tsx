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
        conversation={(id) => ({ href: `/agents/${id}` })}
      />
    </MemoryRouter>,
  );
  return { onConfirm, onRecheck };
}

describe("workspace deletion confirmation", () => {
  it("deletes a clean, pushed clone outright with no Trash alternative", () => {
    const { onConfirm } = show({ state: "checked", check: permanent });
    expect(screen.queryByText(/Siirrä silti roskakoriin/)).toBeNull();
    expect(screen.queryByRole("button", { name: /roskakoriin/i })).toBeNull();
    expect(screen.getByText(/haetaan vielä ennen poistoa/)).toBeTruthy();
    expect(screen.getByText(".env")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Poista pysyvästi" }));
    expect(onConfirm).toHaveBeenCalledWith("permanent");
  });

  it("moves anything only here to the Trash and names where it goes", () => {
    const { onConfirm } = show({ state: "checked", check: trash });
    expect(screen.getByText(/Asetukset › Tallennustila/)).toBeTruthy();
    expect(
      screen.getByText(/2 committia, joita ei ole etärepossa/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Poista pysyvästi" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Siirrä roskakoriin/ }));
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
    expect(screen.getByRole("link", { name: "Avaa keskustelu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Poista|Siirrä/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tarkista uudelleen" }));
    expect(onRecheck).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("after a refused confirm, asks for a fresh check instead of repeating it", () => {
    show({ state: "checked", check: trash, problem: "Työtila muuttui." });
    expect(screen.getByRole("alert").textContent).toBe("Työtila muuttui.");
    expect(
      screen.queryByRole("button", { name: /Siirrä roskakoriin/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tarkista uudelleen" }),
    ).toBeTruthy();
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
    const restore = screen.getByRole("button", { name: "Palauta a" });
    expect(restore.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/~\/src\/a on jo käytössä/)).toBeTruthy();
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
    const button = screen.getByRole("button", { name: "Poista pysyvästi" });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "a.2" } });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith("a");
  });
});
