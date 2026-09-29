import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  GitHubRepoChooser,
  type GitHubRepoChooserProps,
} from "./GitHubRepoChooser";

const repos = [
  {
    full_name: "sample-lab/aurora",
    private: true,
    description: "<img src=x onerror=alert(1)>",
  },
  {
    full_name: "sample-lab/harbor",
    private: false,
    description: "Julkaisun luonnos",
  },
];
function props(): GitHubRepoChooserProps {
  return {
    view: { phase: "catalog", repositories: repos, hasMore: true },
    selectedNames: [],
    checkout: { phase: "idle" },
    onToggle: vi.fn(),
    onCheckout: vi.fn(),
    onMore: vi.fn(),
    onSkip: vi.fn(),
    onContinue: vi.fn(),
  };
}
describe("GitHub first-use chooser", () => {
  it("offers accessible controlled selection and explicit checkout, rendering descriptions as text", async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(<GitHubRepoChooser {...initial} />);
    expect(view.getByText(repos[0].description)).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
    const checkbox = view.getByRole("checkbox", {
      name: /sample-lab\/aurora.*Yksityinen/,
    });
    await user.click(checkbox);
    expect(initial.onToggle).toHaveBeenCalledWith(repos[0].full_name, true);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(
      view
        .getByRole("button", { name: /Hae valitut repot/ })
        .hasAttribute("disabled"),
    ).toBe(true);
    const selected = { ...initial, selectedNames: [repos[0].full_name] };
    view.rerender(<GitHubRepoChooser {...selected} />);
    expect(view.getByText("Valittu 1 repoa.")).toBeTruthy();
    await user.click(view.getByRole("button", { name: "Näytä lisää repoja" }));
    expect(initial.onMore).toHaveBeenCalledOnce();
    await user.click(
      view.getByRole("button", { name: "Hae valitut repot (1)" }),
    );
    expect(initial.onCheckout).toHaveBeenCalledWith([repos[0].full_name]);
    expect(
      view.queryByRole("button", { name: "Jatka Pi-kirjautumiseen" }),
    ).toBeNull();
  });

  it("blocks continuation for progress, partial, uncertain and mismatched confirmations", async () => {
    const user = userEvent.setup();
    const initial = { ...props(), selectedNames: [repos[0].full_name] };
    const view = render(
      <GitHubRepoChooser
        {...initial}
        checkout={{ phase: "progress", completed: 0, total: 1 }}
      />,
    );
    expect(
      view.getByRole("progressbar", { name: "Haettu 0/1 repoa" }),
    ).toBeTruthy();
    for (const checkout of [
      { phase: "partial", completed: 0, total: 1 },
      { phase: "uncertain" },
      { phase: "confirmed", names: [repos[1].full_name] },
    ] as const) {
      view.rerender(<GitHubRepoChooser {...initial} checkout={checkout} />);
      expect(
        view.queryByRole("button", { name: "Jatka Pi-kirjautumiseen" }),
      ).toBeNull();
      expect(
        view.queryByRole("button", { name: /Hae valitut repot/ }),
      ).toBeNull();
    }
    view.rerender(
      <GitHubRepoChooser
        {...initial}
        checkout={{ phase: "confirmed", names: [repos[0].full_name] }}
      />,
    );
    await user.click(
      view.getByRole("button", { name: "Jatka Pi-kirjautumiseen" }),
    );
    expect(initial.onContinue).toHaveBeenCalledOnce();
    expect(initial.onSkip).not.toHaveBeenCalled();
  });

  it("shows no-auth, unavailable, empty and loading without pretending to have checked out; skip is explicit", async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(
      <GitHubRepoChooser {...initial} view={{ phase: "loading" }} />,
    );
    expect(view.getByText(/Haetaan GitHub-repoja/)).toBeTruthy();
    view.rerender(
      <GitHubRepoChooser {...initial} view={{ phase: "no-auth" }} />,
    );
    expect(view.getByText("GitHub-kirjautuminen puuttuu")).toBeTruthy();
    view.rerender(
      <GitHubRepoChooser
        {...initial}
        view={{ phase: "unavailable" }}
        onRefresh={vi.fn()}
      />,
    );
    expect(
      view.getByRole("button", { name: "Tarkista uudelleen" }),
    ).toBeTruthy();
    view.rerender(
      <GitHubRepoChooser
        {...initial}
        view={{ phase: "catalog", repositories: [], hasMore: false }}
      />,
    );
    expect(view.getByText(/Repoja ei löytynyt/)).toBeTruthy();
    await user.click(view.getByRole("button", { name: "Jatka ilman repoja" }));
    expect(initial.onSkip).toHaveBeenCalledOnce();
  });
});
