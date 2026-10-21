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
    const running = screen.getByTestId("return-group-ongoing");
    const others = screen.getByTestId("return-group-recent");
    expect(within(running).getAllByRole("link")).toHaveLength(1);
    expect(within(running).getByRole("link").getAttribute("href")).toBe(
      "/workspaces/ws_example?conversation=two",
    );

    expect(within(others).getAllByRole("link")).toHaveLength(4);
    expect(within(others).getAllByRole("link")[0].getAttribute("href")).toBe(
      "/agents/one",
    );
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
    const urgent = screen.getByTestId("return-group-attention");
    expect(within(urgent).getByRole("link").textContent).toContain(
      "Uusi kysymys",
    );
    expect(
      within(screen.getByTestId("return-group-ongoing")).getByRole("link")
        .textContent,
    ).toContain("Nähty kysymys");
    expect(
      screen
        .getAllByRole("link")
        .some((link) => link.textContent?.includes("Vanha kaksi")),
    ).toBe(true);
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
      within(screen.getByTestId("return-group-attention")).getAllByRole("link"),
    ).toHaveLength(4);
    expect(
      screen
        .getByTestId("return-group-recent")
        .querySelector("[data-history=corrupt]"),
    ).toBeTruthy();
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
    expect(screen.getAllByRole("heading", { level: 2 })[0]).toBeTruthy();
    expect(screen.getByTestId("return-group-recent")).toBeTruthy();
  });
  it("keeps a long native title in the link rather than truncating its text", () => {
    const title = `Pitkä otsikko ${"x".repeat(160)}`;
    show([{ ...base, title }]);
    expect(screen.getByRole("link").textContent).toContain(title);
  });
  it("offers no fabricated return link when the list is empty", () => {
    show([]);

    expect(screen.queryByRole("link")).toBeNull();
  });
});
