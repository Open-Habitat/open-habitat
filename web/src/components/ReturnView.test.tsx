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
    const running = screen.getByRole("region", { name: "Työskentelee" });
    const others = screen.getByRole("region", { name: "Muut keskustelut" });
    expect(within(running).getAllByRole("link")).toHaveLength(1);
    expect(
      within(running)
        .getByRole("link", { name: /Selain/ })
        .getAttribute("href"),
    ).toBe("/workspaces/ws_example?conversation=two");
    expect(within(running).getByText("Prosessi käynnissä")).toBeTruthy();
    expect(within(others).getByText("Käynnissä terminaalissa")).toBeTruthy();
    expect(within(others).getAllByRole("link")).toHaveLength(2);
    expect(
      within(others)
        .getByRole("link", { name: /Keskustelu/ })
        .getAttribute("href"),
    ).toBe("/agents/one");
    expect(
      within(others).getAllByText("Tila ei tiedossa").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Viimeksi avatut")).toBeNull();
    expect(screen.queryByText("Jatkettavissa")).toBeNull();
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
