import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { agentPresentation } from "./agentPresentation";
import { AgentHeader, AgentNavItem, WorkspaceSection } from "./Navigation";

const longTitle =
  "Keskustelu pitkästä aiheesta ja sen eri vaiheista sekä kaikista tähän liittyvistä muutoksista";
function header(title: string) {
  return (
    <MemoryRouter>
      <AgentHeader
        title={title}
        activityLabel="Valmis"
        controlLabel="Luettavissa"
        workspaceLabel="Työtila"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded={false}
        onToggleDetails={() => {}}
      />
    </MemoryRouter>
  );
}
describe("conversation title", () => {
  it("shows the title action beside the title only when enabled", () => {
    let presses = 0;
    const view = render(
      <MemoryRouter>
        <AgentHeader
          title="Native title"
          activityLabel="Valmis"
          controlLabel="Selainohjaus"
          workspaceLabel="Työtila"
          workspaceHref="/workspaces/ws_example00"
          detailsExpanded={false}
          onToggleDetails={() => {}}
          titleAction={{
            label: "Luo uusi otsikko",
            availability: { state: "enabled" },
            onPress: () => {
              presses++;
            },
          }}
        />
      </MemoryRouter>,
    );
    fireEvent.click(view.getByRole("button", { name: "Luo uusi otsikko" }));
    expect(presses).toBe(1);
    view.rerender(
      <MemoryRouter>
        <AgentHeader
          title="Native title"
          activityLabel="Valmis"
          controlLabel="Vain luku"
          workspaceLabel="Työtila"
          workspaceHref="/workspaces/ws_example00"
          detailsExpanded={false}
          onToggleDetails={() => {}}
          titleAction={{
            label: "Luo uusi otsikko",
            availability: { state: "disabled", reason: "Vain luku" },
            onPress: () => {},
          }}
        />
      </MemoryRouter>,
    );
    expect(view.getByRole("button", { name: "Luo uusi otsikko" })).toBeTruthy();
    expect(
      view
        .getByRole("button", { name: "Luo uusi otsikko" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps a long title accessible without adding a disclosure control", () => {
    const view = render(header(longTitle));
    const heading = view.getByRole("heading", { level: 1, name: longTitle });
    expect(heading.getAttribute("title")).toBe(longTitle);
    expect(view.queryByRole("button", { name: /koko otsikko/ })).toBeNull();
    expect(view.getByRole("button", { name: "Tiedot" })).toBeTruthy();
  });
});

describe("workspace conversation rows", () => {
  it("orders new and attention before work and folds finished rows", () => {
    const agent = (
      name: string,
      priority: number,
      finished = false,
      selected = false,
    ) => ({
      agentId: name,
      href: `/agents/${name}`,
      title: name,
      activityLabel: finished ? "Valmis" : "Odottaa",
      controlLabel: "Vain luku",
      priority,
      finished,
      selected,
    });
    const view = render(
      <MemoryRouter>
        <WorkspaceSection
          workspaceId="ws_example00"
          name="source"
          href="/workspaces/ws_example00"
          expanded
          agents={[
            agent("waiting", 3),
            agent("finished", 4, true),
            agent("attention", 1),
            agent("new", 0),
            agent("working", 2),
          ]}
          onToggle={() => {}}
          workspaceMenu={<button type="button">Työtilan toiminnot</button>}
        />
      </MemoryRouter>,
    );
    expect(
      view
        .getAllByRole("link", { name: /waiting|attention|new|working/ })
        .map((row) => row.getAttribute("aria-label")),
    ).toEqual(["new", "attention", "working", "waiting"]);
    expect(view.queryByRole("link", { name: "finished" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Valmiit 1" }));
    expect(view.getByRole("link", { name: "finished" })).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Työtilan toiminnot" }),
    ).toBeTruthy();
  });
});

it("shows native settings in a chip and aligned facts without loose disabled reasons", () => {
  const view = render(
    <MemoryRouter>
      <AgentHeader
        title="Otsikko"
        activityLabel="Odottaa sinua"
        controlLabel="Vain luku"
        workspaceLabel="Repo"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded
        onToggleDetails={() => {}}
        settings={{ model: "provider/model", thinking: "high" }}
        archiveReason="Estetty"
        titleAction={{
          label: "Luo uusi otsikko",
          availability: { state: "disabled", reason: "Ei nimettävää" },
          onPress: () => {},
        }}
      />
    </MemoryRouter>,
  );
  expect(
    view.getByRole("button", { name: "Malli ja ajattelutaso · avaa tiedot" }),
  ).toBeTruthy();
  expect(view.getByRole("region", { name: "Tiedot" }).textContent).toContain(
    "provider/model",
  );
  expect(
    view.getByRole("region", { name: "Tiedot" }).textContent,
  ).not.toContain("Arkistointi:");
  expect(
    view
      .getByRole("button", { name: "Luo uusi otsikko" })
      .getAttribute("aria-describedby"),
  ).toBeTruthy();
  expect(view.container.textContent).toContain("Ei nimettävää");
});
// rail-mark-pulse: a live turn showed the grey ◌ glyph instead of the
// draft's pulsing accent dot, and the whole spinoff mark blinked.
describe("rail activity marks", () => {
  const row = (
    facts: Parameters<typeof agentPresentation>[0],
    spin = false,
  ) => {
    const presentation = agentPresentation(facts);
    return render(
      <MemoryRouter>
        <ul>
          <AgentNavItem
            agentId="pi:a"
            href="/agents/pi:a"
            title="Keskustelu"
            activity={presentation.activity}
            activityLabel={presentation.activityLabel}
            controlLabel={presentation.controlLabel}
            spinoffWorking={spin}
          />
        </ul>
      </MemoryRouter>,
    );
  };
  it("maps a working turn to the working dot, not a glyph", () => {
    const view = row({ process: "daemon_managed_live", runActive: true });
    const mark = view.container.querySelector(".ah-nav-mark");
    expect(mark?.classList.contains("ah-nav-working")).toBe(true);
    expect(mark?.textContent).toBe("");
    expect(mark?.getAttribute("title")).toBe("Agentti työskentelee");
    const link = view.getByRole("link", { name: "Keskustelu" });
    expect(
      document.getElementById(link.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toMatch(/Työskentelee/);
  });
  it("keeps waiting as the ring glyph", () => {
    const view = row({ process: "daemon_managed_live", runActive: false });
    const mark = view.container.querySelector(".ah-nav-mark");
    expect(mark?.classList.contains("ah-nav-working")).toBe(false);
    expect(mark?.textContent).toBe("○");
  });
  it("pulses only the branch of a working spinoff's mark", () => {
    const view = row(
      { process: "daemon_managed_live", runActive: false },
      true,
    );
    const mark = view.container.querySelector("svg.ah-nav-spinoff");
    expect(mark).not.toBeNull();
    const branch = mark?.querySelector(".ah-nav-spinoff-branch");
    expect(branch?.querySelectorAll("path, circle")).toHaveLength(2);
    // The trunk (top dot and stem) stays outside the pulsing group.
    expect(
      mark?.querySelectorAll(":scope > path, :scope > circle"),
    ).toHaveLength(2);
  });
});
