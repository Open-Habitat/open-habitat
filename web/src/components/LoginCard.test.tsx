import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginCard, LoginErrorNotice } from "./LoginCard";

describe("login presentation", () => {
  it("welcomes the person and offers a retry without technical account details", () => {
    const onLogin = vi.fn();
    const view = render(<LoginCard onLogin={onLogin} />);
    expect(
      view.getByRole("heading", { name: "Tervetuloa Open Habitatiin" }),
    ).toBeTruthy();
    expect(view.queryByText(/Unix|natiivin|UID|daemon/)).toBeNull();
    view.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    expect(onLogin).toHaveBeenCalledOnce();
  });
  it("uses danger styling and a generic support instruction without diagnostic detail", () => {
    const view = render(<LoginErrorNotice />);
    const notice = view
      .getByText("Kirjautumisessa tapahtui virhe")
      .closest("aside");
    expect(notice?.classList.contains("ah-tone-danger")).toBe(true);
    expect(notice?.textContent).toContain("ota yhteyttä palvelun ylläpitäjään");
    expect(notice?.textContent).not.toContain("auth_error");
  });
});
