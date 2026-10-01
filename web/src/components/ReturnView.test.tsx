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
  });
  it("groups only positively observed running processes, preserving links and native history", () => {
    show([
      base,
      {
        ...base,
        id: "two",
        href: "/workspaces/ws_example?conversation=two",
        title: "Selain",
        browserSession: true,
        process: "daemon_managed_live",
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
    expect(within(running).getAllByRole("link")).toHaveLength(2);
    expect(
      within(running)
        .getByRole("link", { name: /Selain/ })
        .getAttribute("href"),
    ).toBe("/workspaces/ws_example?conversation=two");
    expect(within(running).getByText("Prosessi käynnissä")).toBeTruthy();
    expect(within(running).getByText("Käynnissä terminaalissa")).toBeTruthy();
    expect(within(others).getAllByRole("link")).toHaveLength(3);
    expect(
      within(others)
        .getByRole("link", { name: /Keskustelu/ })
        .getAttribute("href"),
    ).toBe("/agents/one");
    expect(within(others).queryByText(/käynnissä/i)).toBeNull();
    expect(screen.queryByText("Viimeksi avatut")).toBeNull();
    expect(screen.queryByText("Jatkettavissa")).toBeNull();
  });
  it("offers no fabricated return link when the list is empty", () => {
    show([]);
    expect(screen.getByText(/Keskusteluja ei vielä näy/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
