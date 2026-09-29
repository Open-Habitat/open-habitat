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
    onProceed: vi.fn(),
    onMore: vi.fn(),
    onRecheck: vi.fn(),
  };
}
describe("GitHub first-use chooser", () => {
  it("selects without writing, navigates pages, then sends exactly the controlled names once", async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(<GitHubRepoChooser {...initial} />);
    expect(view.getByText(repos[0].description)).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
    const checkbox = view.getByRole("checkbox", {
      name: /sample-lab\/aurora.*Yksityinen/,
    });
    expect(checkbox.getAttribute("aria-describedby")).toBe(
      "github-chooser-instructions",
    );
    expect(
      view.getByText(/Silloin valitut repot haetaan koneelle/),
    ).toBeTruthy();
    await user.click(checkbox);
    expect(initial.onToggle).toHaveBeenCalledWith(repos[0].full_name, true);
    expect(initial.onProceed).not.toHaveBeenCalled();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    const selected = { ...initial, selectedNames: [repos[0].full_name] };
    view.rerender(<GitHubRepoChooser {...selected} />);
    await user.click(view.getByRole("button", { name: "Näytä lisää repoja" }));
    expect(initial.onMore).toHaveBeenCalledOnce();
    expect(initial.onProceed).not.toHaveBeenCalled();
    await user.click(view.getByRole("button", { name: "Jatka" }));
    expect(initial.onProceed).toHaveBeenCalledExactlyOnceWith([
      repos[0].full_name,
    ]);
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect(
      view.getByRole("button", { name: "Jatka" }).hasAttribute("disabled"),
    ).toBe(true);
    view.rerender(
      <GitHubRepoChooser {...selected} selectedNames={[repos[1].full_name]} />,
    );
    expect(initial.onProceed).toHaveBeenCalledOnce();
  });

  it("allows continuing without repos, including empty catalog and missing GitHub auth", async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(
      <GitHubRepoChooser
        {...initial}
        view={{ phase: "catalog", repositories: [], hasMore: false }}
      />,
    );
    await user.click(view.getByRole("button", { name: "Jatka" }));
    expect(initial.onProceed).toHaveBeenCalledExactlyOnceWith([]);
    view.unmount();
    const noAuth = render(
      <GitHubRepoChooser {...initial} view={{ phase: "no-auth" }} />,
    );
    await user.click(noAuth.getByRole("button", { name: "Jatka" }));
    expect(initial.onProceed).toHaveBeenCalledTimes(2);
    expect(initial.onProceed).toHaveBeenLastCalledWith([]);
  });

  it("keeps Jatka and selection available during read-only pagination", async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(
      <GitHubRepoChooser
        {...initial}
        view={{
          phase: "catalog",
          repositories: repos,
          hasMore: true,
          loadingMore: true,
        }}
      />,
    );
    expect(
      (
        view.getByRole("checkbox", {
          name: /sample-lab\/aurora/,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
    await user.click(view.getByRole("button", { name: "Jatka" }));
    expect(initial.onProceed).toHaveBeenCalledExactlyOnceWith([]);
  });

  it("shows progress, partial and uncertain outcomes without another write; recheck is read-only", async () => {
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
    expect(view.queryByRole("button", { name: "Jatka" })).toBeNull();
    expect(
      (
        view.getByRole("checkbox", {
          name: /sample-lab\/aurora/,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    for (const checkout of [
      { phase: "partial", completed: 0, total: 1 },
      { phase: "uncertain" },
      { phase: "confirmed", names: [repos[1].full_name] },
    ] as const) {
      view.rerender(<GitHubRepoChooser {...initial} checkout={checkout} />);
      expect(view.queryByRole("button", { name: "Jatka" })).toBeNull();
      await user.click(
        view.getByRole("button", { name: "Tarkista haun tila" }),
      );
    }
    expect(initial.onRecheck).toHaveBeenCalledTimes(3);
    expect(initial.onProceed).not.toHaveBeenCalled();
    view.rerender(
      <GitHubRepoChooser
        {...initial}
        checkout={{ phase: "confirmed", names: [repos[0].full_name] }}
      />,
    );
    expect(view.getByText("Valittu 1 repoa.")).toBeTruthy();
    expect(view.getByText(/Siirrytään Pi-kirjautumiseen/)).toBeTruthy();
    expect(view.queryByRole("button", { name: "Jatka" })).toBeNull();
  });

  it("offers catalog refresh on failure, but no write without a known catalog", async () => {
    const user = userEvent.setup();
    const initial = { ...props(), onRefresh: vi.fn() };
    const view = render(
      <GitHubRepoChooser {...initial} view={{ phase: "loading" }} />,
    );
    expect(view.getByText(/Haetaan GitHub-repoja/)).toBeTruthy();
    expect(view.queryByRole("button", { name: "Jatka" })).toBeNull();
    view.rerender(
      <GitHubRepoChooser {...initial} view={{ phase: "unavailable" }} />,
    );
    await user.click(view.getByRole("button", { name: "Tarkista uudelleen" }));
    expect(initial.onRefresh).toHaveBeenCalledOnce();
    expect(initial.onProceed).not.toHaveBeenCalled();
  });
});
