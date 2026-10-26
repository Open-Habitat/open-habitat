import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { agentPresentation } from "./agentPresentation";
import { AgentHeader, AgentNavItem } from "./Navigation";

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
    fireEvent.click(view.getByTestId("conversation-retitle"));
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
    expect(view.getByTestId("conversation-retitle")).toBeTruthy();
    expect(
      view.getByTestId("conversation-retitle").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps the native title while pending and clears busy on completion or failure", () => {
    const draw = (pending: boolean, title: string) => (
      <MemoryRouter>
        <AgentHeader
          title={title}
          titlePending={pending}
          activityLabel="Valmis"
          controlLabel="Selainohjaus"
          workspaceLabel="Työtila"
          workspaceHref="/workspaces/ws_example00"
          detailsExpanded={false}
          onToggleDetails={() => {}}
          titleAction={{
            label: "Luo otsikko",
            availability: { state: "enabled" },
            onPress: () => {},
          }}
        />
      </MemoryRouter>
    );
    const view = render(draw(true, longTitle));
    expect(
      view.getByTestId("conversation-title").getAttribute("aria-busy"),
    ).toBe("true");
    expect(view.getByTestId("workspace-title").textContent).toBe(longTitle);
    expect(
      view.getByTestId("conversation-retitle").hasAttribute("disabled"),
    ).toBe(true);
    view.rerender(draw(false, "Native replacement"));
    expect(
      view.getByTestId("conversation-title").getAttribute("aria-busy"),
    ).toBe("false");
    expect(view.getByTestId("workspace-title").textContent).toBe(
      "Native replacement",
    );
    view.rerender(draw(true, "Native replacement"));
    view.rerender(draw(false, "Native replacement"));
    expect(
      view.getByTestId("conversation-title").getAttribute("aria-busy"),
    ).toBe("false");
    expect(view.getByTestId("workspace-title").textContent).toBe(
      "Native replacement",
    );
    expect(
      view.getByTestId("conversation-retitle").hasAttribute("disabled"),
    ).toBe(false);
  });

  it("keeps a long title accessible without adding a disclosure control", () => {
    const view = render(header(longTitle));
    const heading = view.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(longTitle);
    expect(view.getAllByRole("button")).toHaveLength(1);
    expect(view.getByTestId("workspace-details")).toBeTruthy();
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
  expect(view.getAllByTestId("workspace-details")).toBeTruthy();
  expect(view.getByRole("region").textContent).toContain("provider/model");

  expect(
    view.getByTestId("conversation-retitle").getAttribute("aria-describedby"),
  ).toBeTruthy();
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

    const link = view.getByRole("link");
    expect(
      document.getElementById(link.getAttribute("aria-describedby") ?? ""),
    ).toBeTruthy();
  });
  it("keeps waiting as the ring glyph", () => {
    const view = row({ process: "daemon_managed_live", runActive: false });
    const mark = view.container.querySelector(".ah-nav-mark");
    expect(mark?.classList.contains("ah-nav-working")).toBe(false);
    expect(mark?.textContent).toBe("○");
  });
  it("gives a background wait its own still dot", () => {
    const view = row({
      process: "daemon_managed_live",
      command: "idle",
      waitingOn: [
        { process_id: "p", name: "testit", kind: "process", run_ids: [] },
      ],
    });
    const mark = view.container.querySelector(".ah-nav-mark");
    expect(mark?.classList.contains("ah-nav-background")).toBe(true);
    expect(mark?.classList.contains("ah-nav-working")).toBe(false);
    expect(mark?.textContent).toBe("");
    expect(view.container.querySelector('[data-waiting="true"]')).toBeTruthy();
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
