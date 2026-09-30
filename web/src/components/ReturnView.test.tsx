import { render, screen } from "@testing-library/react";
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
  it("does not infer running from an unobserved process", () => {
    show([base]);
    expect(screen.getByText("Vain luettavissa")).toBeTruthy();
    expect(screen.queryByText(/Prosessi käynnissä/)).toBeNull();
  });
  it("marks only observed live processes as running", () => {
    show([
      { ...base, process: "daemon_managed_live" },
      { ...base, id: "two", process: "terminal_observed_live" },
    ]);
    expect(screen.getByText("Prosessi käynnissä")).toBeTruthy();
    expect(screen.getByText("Käynnissä terminaalissa")).toBeTruthy();
  });
  it("offers no fabricated return link when the list is empty", () => {
    show([]);
    expect(screen.getByText(/Keskusteluja ei vielä näy/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
