import { cleanup, fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { setPersonalLanguage } from "../i18n";
import { type AgentNavModel, NowSections } from "./Navigation";
import { type SectionChoice, sectionView } from "./SectionFilter";

afterEach(() => {
  cleanup();
  setPersonalLanguage("fi");
});

const row = (
  agentId: string,
  workspaceId: string,
  selected = false,
): AgentNavModel => ({
  agentId,
  title: `Keskustelu ${agentId}`,
  href: `/agents/${agentId}`,
  activity: "working",
  activityLabel: "Työskentelee",
  controlLabel: "",
  workspaceId,
  workspaceName: workspaceId.replace("ws_", ""),
  selected,
});
const ids = (r: AgentNavModel[]) => r.map((a) => a.agentId);
const workspaces = [
  { id: "ws_alpha", name: "alpha" },
  { id: "ws_beta", name: "beta" },
  { id: "ws_gamma", name: "gamma" },
];

describe("sectionView", () => {
  const rows = [row("a", "ws_beta"), row("b", "ws_alpha", true)];
  it("narrows to one workspace and keeps the open row last, marked", () => {
    const view = sectionView(rows, "ws_beta", workspaces);
    expect(ids(view.shown)).toEqual(["a", "b"]);
    expect(view.shown[1].kept).toBe(true);
    expect(view.count).toBe(1);
  });
  it("reads a workspace no longer listed as every one, and keeps a listed empty one", () => {
    expect(sectionView(rows, "ws_gone12345", workspaces).workspace).toBeNull();
    const empty = sectionView(rows, "ws_gamma", workspaces);
    expect(empty.workspace).toBe("ws_gamma");
    expect(empty.count).toBe(0);
    expect(empty.places.map((p) => [p.id, p.count])).toEqual([
      ["ws_alpha", 1],
      ["ws_beta", 1],
      ["ws_gamma", 0],
    ]);
  });
});

describe("NowSections workspace filter", () => {
  it("puts truly empty states in their headings and removes them when populated", () => {
    const rows = [row("a", "ws_beta")];
    const view = render(
      <MemoryRouter>
        <NowSections yours={[]} running={[]} />
      </MemoryRouter>,
    );
    for (const id of ["rail-yours", "rail-running"]) {
      const section = view.getByTestId(id);
      expect(
        section
          .querySelector("h2")
          ?.contains(section.querySelector('[role="status"]')),
      ).toBe(true);
      expect(section.querySelector("ul")).toBeNull();
    }
    view.rerender(
      <MemoryRouter>
        <NowSections yours={rows} running={rows} />
      </MemoryRouter>,
    );
    expect(view.queryAllByRole("status")).toHaveLength(0);
  });
  const yours = [
    row("y1", "ws_alpha"),
    row("y2", "ws_beta"),
    row("y3", "ws_alpha"),
  ];
  const running = [row("r1", "ws_beta"), row("r2", "ws_beta")];
  const choice = (c: Partial<SectionChoice> = {}): SectionChoice => ({
    workspace: null,
    onWorkspace: () => {},
    ...c,
  });
  const ui = (
    yoursChoice: SectionChoice,
    runningChoice: SectionChoice,
    rows = { yours, running },
  ) => (
    <MemoryRouter>
      <NowSections
        yours={rows.yours}
        running={rows.running}
        yoursChoice={yoursChoice}
        runningChoice={runningChoice}
        workspaces={workspaces}
      />
    </MemoryRouter>
  );

  it("offers the filter only where rows come from more than one workspace", () => {
    const view = render(ui(choice(), choice()));
    expect(view.getByTestId("rail-yours-menu")).toBeTruthy();
    // Käynnissä has only beta: nothing to choose between.
    expect(view.queryByTestId("rail-running-menu")).toBeNull();
    expect(view.getByTestId("rail-yours-count").textContent).toBe("3");
  });

  it("narrows each section on its own and counts shown of all", () => {
    const view = render(
      ui(choice({ workspace: "ws_alpha" }), choice({ workspace: null })),
    );
    const section = view.getByTestId("rail-yours");
    expect(
      within(section)
        .getAllByTestId(/^agent-item-/)
        .map((el) => el.getAttribute("data-testid")),
    ).toEqual(["agent-item-y1", "agent-item-y3"]);
    expect(
      view.getByTestId("rail-yours-count").querySelector("[aria-hidden]")
        ?.textContent,
    ).toBe("2/3");
    expect(
      view.getByTestId("rail-yours-menu").getAttribute("data-narrowed"),
    ).toBe("true");
    // Käynnissä is not narrowed by Sinun vuorosi's choice.
    expect(
      within(view.getByTestId("rail-running")).getAllByTestId(/^agent-item-/),
    ).toHaveLength(2);
  });

  it("keeps a narrowed section's control though its rows share a workspace", () => {
    const view = render(ui(choice(), choice({ workspace: "ws_alpha" })));
    expect(view.getByTestId("rail-running-menu")).toBeTruthy();
  });

  it("says when the chosen workspace has nothing and offers every one back", () => {
    const chosen: (string | null)[] = [];
    const view = render(
      ui(
        choice(),
        choice({
          workspace: "ws_gamma",
          onWorkspace: (id) => chosen.push(id),
        }),
      ),
    );
    const section = view.getByTestId("rail-running");
    expect(within(section).queryAllByTestId(/^agent-item-/)).toHaveLength(0);
    expect(section.textContent).toContain("Ei mitään työtilasta gamma.");
    expect(section.textContent).not.toContain("Mikään ei ole käynnissä.");
    fireEvent.click(view.getByTestId("rail-running-show-all"));
    expect(chosen).toEqual([null]);
  });

  it("says beside Näytä kaikki when clearing was not saved", () => {
    const view = render(
      ui(choice(), choice({ workspace: "ws_gamma", error: true })),
    );
    expect(view.getByTestId("rail-running-show-all-error").textContent).toBe(
      "Valintaa ei tallennettu. Yritä uudelleen.",
    );
  });

  it("keeps the open conversation in sight outside the narrowing", () => {
    const view = render(
      ui(choice({ workspace: "ws_beta" }), choice(), {
        yours: [row("y1", "ws_alpha", true), row("y2", "ws_beta")],
        running,
      }),
    );
    const kept = view.getByTestId("agent-item-y1");
    expect(kept.textContent).toContain("avoinna, rajauksen ulkopuolelta");
  });

  it("chooses a workspace from the tiles", async () => {
    const chosen: (string | null)[] = [];
    const view = render(
      ui(choice({ onWorkspace: (id) => chosen.push(id) }), choice()),
    );
    await userEvent.click(view.getByTestId("rail-yours-menu"));
    const dialog = await view.findByTestId("rail-yours-dialog");
    expect(
      within(dialog)
        .getByTestId("rail-yours-tile-all")
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await userEvent.click(
      within(dialog).getByTestId("rail-yours-tile-ws_beta"),
    );
    expect(chosen).toEqual(["ws_beta"]);
  });

  it("waits while a choice is on its way and says when it was not saved", async () => {
    const view = render(ui(choice({ busy: true, error: true }), choice()));
    await userEvent.click(view.getByTestId("rail-yours-menu"));
    const dialog = await view.findByTestId("rail-yours-dialog");
    expect(
      (
        within(dialog).getByTestId(
          "rail-yours-tile-ws_beta",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(within(dialog).getByTestId("rail-yours-error")).toBeTruthy();
  });

  it("shows every row in the narrow rail, which has no heading", () => {
    const view = render(
      <MemoryRouter>
        <NowSections
          collapsed
          yours={yours}
          running={running}
          yoursChoice={choice({ workspace: "ws_alpha" })}
          runningChoice={choice({ workspace: "ws_alpha" })}
          workspaces={workspaces}
        />
      </MemoryRouter>,
    );
    expect(view.container.querySelectorAll("li")).toHaveLength(5);
    expect(view.queryByTestId("rail-yours-menu")).toBeNull();
  });

  it("speaks English", () => {
    setPersonalLanguage("en-US");
    const view = render(ui(choice(), choice({ workspace: "ws_gamma" })));
    expect(view.getByTestId("rail-yours-menu").getAttribute("aria-label")).toBe(
      "Filter Your turn by workspace",
    );
    expect(view.getByTestId("rail-running").textContent).toContain(
      "Nothing from gamma.",
    );
  });
});
