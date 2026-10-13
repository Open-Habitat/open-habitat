import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AgentHeader, WorkspaceSection } from "./Navigation";

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
        />
      </MemoryRouter>,
    );
    expect(view.queryByRole("button", { name: "Luo uusi otsikko" })).toBeNull();
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
          onNewConversation={() => {}}
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
      view.getByRole("button", { name: "Uusi keskustelu työtilassa source" }),
    ).toBeTruthy();
  });
});
