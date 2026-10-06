import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { type ReturnConversation, ReturnView } from "./ReturnView";

const base: ReturnConversation = {
  id: "one",
  href: "/agents/one",
  title: "Keskustelu",
  workspace: "esimerkki",
  browserSession: false,
  process: "not_observed",
};
function show(conversations: ReturnConversation[]) {
  return render(
    <MemoryRouter>
      <ReturnView conversations={conversations} />
    </MemoryRouter>,
  );
}
describe("return view", () => {
  it("uses the return heading without a separate workspace introduction", () => {
    show([base]);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Jatka siitä, mihin jäit",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Työtilat" })).toBeNull();
    expect(screen.getByText(/Selainistunnon ohjaus riippuu/)).toBeTruthy();
  });
  it("groups proven work separately from merely observed processes, preserving links and native history", () => {
    show([
      base,
      {
        ...base,
        id: "two",
        href: "/workspaces/ws_example?conversation=two",
        title: "Selain",
        browserSession: true,
        process: "daemon_managed_live",
        command: "accepted",
      },
      {
        ...base,
        id: "three",
        title: "Terminaali",
        process: "terminal_observed_live",
      },
      { ...base, id: "four", title: "Epäselvä", process: "stale" },
      {
        ...base,
        id: "five",
        title: "Päättynyt",
        browserSession: true,
        process: "confirmed_exited",
      },
    ]);
    const running = screen.getByRole("region", { name: "Käynnissä" });
    const others = screen.getByRole("region", { name: "Muut keskustelut" });
    expect(within(running).getAllByRole("link")).toHaveLength(1);
    expect(
      within(running)
        .getByRole("link", { name: /Selain/ })
        .getAttribute("href"),
    ).toBe("/workspaces/ws_example?conversation=two");
    expect(within(running).getByText("Prosessi käynnissä")).toBeTruthy();
    expect(within(others).getByText("Käynnissä terminaalissa")).toBeTruthy();
    expect(within(others).getAllByRole("link")).toHaveLength(4);
    expect(
      within(others)
        .getByRole("link", { name: /Keskustelu/ })
        .getAttribute("href"),
    ).toBe("/agents/one");
    expect(
      within(others).getAllByText("Tila ei tiedossa").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Muut keskustelut")).toBeTruthy();
  });
  it("promotes newly observed attention ahead of the three-item cutoff and retains a seen wait", () => {
    show([
      { ...base, id: "old-1", title: "Vanha yksi" },
      { ...base, id: "old-2", title: "Vanha kaksi" },
      {
        ...base,
        id: "wait",
        title: "Nähty kysymys",
        process: "daemon_managed_live",
        command: "idle",
        attention: "seen",
      },
      {
        ...base,
        id: "new",
        title: "Uusi kysymys",
        process: "daemon_managed_live",
        pendingQuestion: true,
        attention: "new",
      },
    ]);
    const urgent = screen.getByRole("region", { name: "Odottaa sinua" });
    expect(
      within(urgent).getByRole("link", { name: /Uusi kysymys/ }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Käynnissä" })).getByRole(
        "link",
        { name: /Nähty kysymys/ },
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Vanha kaksi/ })).toBeTruthy();
  });
  it("keeps all new attention visible ahead of ongoing rows and distinguishes a history error", () => {
    show([
      ...Array.from({ length: 4 }, (_, index) => ({
        ...base,
        id: `new-${index}`,
        title: `Uusi ${index}`,
        attention: "new" as const,
      })),
      { ...base, id: "error", title: "Rikki", history: "corrupt" },
    ]);
    expect(
      within(
        screen.getByRole("region", { name: "Odottaa sinua" }),
      ).getAllByRole("link"),
    ).toHaveLength(4);
    expect(screen.getByText("Historia ei luettavissa")).toBeTruthy();
    expect(screen.getAllByText("Vain luku").length).toBeGreaterThan(0);
  });
  it("treats temporarily unavailable history as unknown rather than a confirmed error", () => {
    show([{ ...base, history: "unavailable" }]);
    expect(screen.getByText("Historiaa ei voitu tarkistaa")).toBeTruthy();
    expect(screen.queryByText("Historia ei luettavissa")).toBeNull();
  });
  it("uses a subordinate heading for workspace conversations", () => {
    render(
      <MemoryRouter>
        <ReturnView
          workspaceName="Työtilan keskustelut"
          conversations={[base]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Työtilan keskustelut" }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Keskustelut" })).toBeTruthy();
  });
  it("keeps a long native title in the link rather than truncating its text", () => {
    const title = `Pitkä otsikko ${"x".repeat(160)}`;
    show([{ ...base, title }]);
    expect(screen.getByRole("link", { name: new RegExp(title) })).toBeTruthy();
  });
  it("offers no fabricated return link when the list is empty", () => {
    show([]);
    expect(screen.getByText(/Keskusteluja ei vielä näy/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
