import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AgentHeader } from "./Navigation";

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
  it("keeps the original title accessible while its two-line view can be expanded", () => {
    const view = render(header(longTitle));
    const heading = view.getByRole("heading", { level: 1, name: longTitle });
    expect(heading.getAttribute("title")).toBe(longTitle);
    expect(heading.classList.contains("ah-title-expanded")).toBe(false);
    const toggle = view.getByRole("button", { name: "Näytä koko otsikko" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(heading.classList.contains("ah-title-expanded")).toBe(true);
    expect(
      view
        .getByRole("button", { name: "Tiivistä otsikko" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    view.rerender(header("Toinen, lyhyt otsikko"));
    expect(
      view
        .getByRole("heading", { level: 1, name: "Toinen, lyhyt otsikko" })
        .classList.contains("ah-title-expanded"),
    ).toBe(false);
    expect(
      view.queryByRole("button", { name: "Näytä koko otsikko" }),
    ).toBeNull();
  });
});
