import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentNavModel } from "./Navigation";
import { type QuietChoice, QuietSection, quietView } from "./QuietSection";

afterEach(cleanup);

const row = (
  agentId: string,
  title: string,
  workspaceId: string,
  changedAt: number,
  selected = false,
): AgentNavModel => ({
  agentId,
  title,
  href: `/agents/${agentId}`,
  activity: "closed",
  activityLabel: "Valmis",
  controlLabel: "",
  workspaceId,
  workspaceName: workspaceId.replace("ws_", ""),
  changedAt,
  selected,
});
// Newest first, as railNow gives them.
const rows = [
  row("a", "Öljy", "ws_beta", 5),
  row("b", "Aamu", "ws_alpha", 4),
  row("c", "Kahvi", "ws_beta", 3),
  row("d", "Banaani", "ws_alpha", 2, true),
  row("e", "Cello", "ws_gamma", 1),
];
const ids = (r: AgentNavModel[]) => r.map((a) => a.agentId);
const choice = (c: Partial<QuietChoice>): QuietChoice => ({
  sort: "newest",
  workspace: null,
  ...c,
});

describe("quietView", () => {
  it("orders newest first, by workspace or by name", () => {
    expect(ids(quietView(rows, choice({})).shown)).toEqual(ids(rows));
    expect(ids(quietView(rows, choice({ sort: "name" })).shown)).toEqual([
      "b",
      "d",
      "e",
      "c",
      "a",
    ]);
    expect(ids(quietView(rows, choice({ sort: "workspace" })).shown)).toEqual([
      "b",
      "d",
      "a",
      "c",
      "e",
    ]);
    expect(
      quietView(rows, choice({})).places.map((p) => [p.id, p.count]),
    ).toEqual([
      ["ws_alpha", 2],
      ["ws_beta", 2],
      ["ws_gamma", 1],
    ]);
  });
  it("narrows to one workspace without the by-workspace order, keeping the open row", () => {
    const view = quietView(
      rows,
      choice({ sort: "workspace", workspace: "ws_beta" }),
    );
    expect(view.sort).toBe("newest");
    expect(view.sorts).toEqual(["newest", "name"]);
    expect(ids(view.shown)).toEqual(["a", "c", "d"]);
    expect(view.shown.at(-1)?.kept).toBe(true);
    // Back on every workspace the stored order returns.
    expect(quietView(rows, choice({ sort: "workspace" })).sort).toBe(
      "workspace",
    );
  });
  it("reads a workspace no longer listed as every workspace", () => {
    const view = quietView(rows, choice({ workspace: "ws_gone12345" }), []);
    expect(view.workspace).toBeNull();
    expect(view.shown).toHaveLength(rows.length);
  });
  it("keeps a listed workspace chosen while nothing in it is quiet", () => {
    const view = quietView(rows, choice({ workspace: "ws_delta" }), [
      { id: "ws_delta", name: "delta" },
    ]);
    expect(view.workspace).toBe("ws_delta");
    expect(ids(view.shown)).toEqual(["d"]);
    expect(view.places.find((p) => p.id === "ws_delta")?.count).toBe(0);
  });
  it("keeps two workspaces of the same name apart", () => {
    const same = [
      { ...row("x", "X", "ws_one", 3), workspaceName: "blog" },
      { ...row("y", "Y", "ws_two", 2), workspaceName: "blog" },
      { ...row("z", "Z", "ws_one", 1), workspaceName: "blog" },
    ];
    expect(ids(quietView(same, choice({ sort: "workspace" })).shown)).toEqual([
      "x",
      "z",
      "y",
    ]);
  });
});

describe("QuietSection", () => {
  it("folds to the open row and pills that open one workspace", () => {
    const folds: boolean[] = [];
    const chosen: (string | null)[] = [];
    const ui = (folded: boolean) => (
      <MemoryRouter>
        <QuietSection
          rows={rows}
          folded={folded}
          onFold={(f) => folds.push(f)}
          choice={choice({ onWorkspace: (id) => chosen.push(id) })}
        />
      </MemoryRouter>
    );
    const view = render(ui(true));
    expect(
      view.container.querySelectorAll('[data-testid^="agent-item-"]'),
    ).toHaveLength(1);
    expect(view.getByTestId("agent-item-d")).toBeTruthy();
    expect(view.queryByTestId("rail-quiet-menu")).toBeNull();
    fireEvent.click(view.getByTestId("rail-quiet-pill-ws_gamma"));
    expect(folds).toEqual([false]);
    expect(chosen).toEqual(["ws_gamma"]);
    view.rerender(ui(false));
    expect(
      view.container.querySelectorAll('[data-testid^="agent-item-"]'),
    ).toHaveLength(5);
    expect(
      view.getByTestId("rail-quiet-fold").getAttribute("aria-expanded"),
    ).toBe("true");
    // Without icons each row names its workspace; there are no headings.
    expect(view.getAllByTestId("rail-row-workspace")).toHaveLength(5);
    expect(view.container.querySelectorAll("h3")).toHaveLength(0);
  });
  it("waits with the pills while a choice is on its way", () => {
    const folds: boolean[] = [];
    const view = render(
      <MemoryRouter>
        <QuietSection
          rows={rows}
          folded
          onFold={(f) => folds.push(f)}
          choice={choice({ busy: true, onWorkspace: () => {} })}
        />
      </MemoryRouter>,
    );
    const pill = view.getByTestId("rail-quiet-pill-ws_beta");
    expect((pill as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pill);
    expect(folds).toEqual([]);
  });
  it("says so when nothing is quiet, without a menu", () => {
    const view = render(
      <MemoryRouter>
        <QuietSection rows={[]} choice={choice({})} />
      </MemoryRouter>,
    );
    expect(view.getByText("Ei hiljaisia keskusteluja.")).toBeTruthy();
    expect(view.queryByTestId("rail-quiet-menu")).toBeNull();
  });
});
