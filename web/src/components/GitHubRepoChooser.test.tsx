import { render, within } from "@testing-library/react";
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
    pushed_at: "2026-09-28T12:00:00Z",
  },
  {
    full_name: "sample-lab/harbor",
    private: false,
    description: "Julkaisun luonnos",
    pushed_at: null,
  },
];
function props(): GitHubRepoChooserProps {
  return {
    view: { phase: "catalog", repositories: repos },
    selectedNames: [],
    onToggle: vi.fn(),
    onProceed: vi.fn(),
  };
}
describe("GitHub first-use chooser", () => {
  it("shows the server and three stages, with all repos visible until filtering is chosen", async () => {
    const user = userEvent.setup();
    const view = render(<GitHubRepoChooser {...props()} />);
    expect(
      view.getByTestId("onboarding-steps").querySelectorAll("li"),
    ).toHaveLength(3);
    expect(view.getByText(window.location.host)).toBeTruthy();
    expect(view.getByText("sample-lab/aurora")).toBeTruthy();
    expect(view.getByText("sample-lab/harbor")).toBeTruthy();
    await user.selectOptions(view.getByRole("combobox"), "7");
    expect(view.getByRole("combobox")).toBeTruthy();
    expect(view.queryByText("sample-lab/aurora")).toBeNull();
    // An unknown update time is not grounds to hide a repository.
    expect(view.getByText("sample-lab/harbor")).toBeTruthy();
    await user.selectOptions(view.getByRole("combobox"), "0");
    expect(view.getByText("sample-lab/aurora")).toBeTruthy();
  });
  it("filters names without writing, then sends exactly the controlled names once", async () => {
    const user = userEvent.setup();
    const initial = props();
    const view = render(<GitHubRepoChooser {...initial} />);
    expect(view.getByText(repos[0].description)).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
    const checkbox = view.getByTestId("repository-sample-lab/aurora");
    expect(checkbox.getAttribute("aria-describedby")).toBe(
      "github-chooser-instructions",
    );

    await user.click(checkbox);
    expect(initial.onToggle).toHaveBeenCalledWith(repos[0].full_name, true);
    expect(initial.onProceed).not.toHaveBeenCalled();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    const selected = { ...initial, selectedNames: [repos[0].full_name] };
    view.rerender(<GitHubRepoChooser {...selected} />);
    await user.type(view.getByRole("searchbox"), "HARBOR");
    expect(view.queryByText("sample-lab/aurora")).toBeNull();
    expect(view.getByText("sample-lab/harbor")).toBeTruthy();

    await user.clear(view.getByRole("searchbox"));

    expect(initial.onProceed).not.toHaveBeenCalled();
    await user.click(view.getByTestId("repository-proceed"));
    expect(initial.onProceed).toHaveBeenCalledExactlyOnceWith([
      repos[0].full_name,
    ]);
    // While the parent moves on, neither the selection nor Continue changes.
    view.rerender(<GitHubRepoChooser {...selected} busy />);
    expect(
      (view.getByTestId("repository-sample-lab/aurora") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    await user.click(view.getByTestId("repository-proceed"));
    expect(initial.onProceed).toHaveBeenCalledOnce();
  });

  // Jari 23.10.2026: a new person stranded on an unreadable catalog had no
  // way forward. Every phase continues, and outside a known catalog never
  // with names the person can no longer see.
  it("continues without repos in every phase, with names only from a known catalog", async () => {
    const user = userEvent.setup();
    const initial = {
      ...props(),
      selectedNames: [repos[0].full_name],
      onRefresh: vi.fn(),
    };
    const view = render(
      <GitHubRepoChooser
        {...initial}
        view={{ phase: "catalog", repositories: [] }}
        selectedNames={[]}
      />,
    );
    await user.click(view.getByTestId("repository-proceed"));
    for (const phase of ["loading", "no-auth", "unavailable"] as const) {
      view.rerender(<GitHubRepoChooser {...initial} view={{ phase }} />);
      await user.click(view.getByTestId("repository-proceed"));
    }
    expect(initial.onProceed).toHaveBeenCalledTimes(4);
    for (const call of vi.mocked(initial.onProceed).mock.calls)
      expect(call).toEqual([[]]);
    // The unavailable catalog still offers its read again, not a write.
    await user.click(
      within(view.getByTestId("repository-unavailable")).getByTestId(
        "notice-action",
      ),
    );
    expect(initial.onRefresh).toHaveBeenCalledOnce();
  });
});

it("bulk-selects only visible repos and preserves hidden selections", async () => {
  const user = userEvent.setup();
  const initial = { ...props(), selectedNames: [repos[0].full_name] };
  const view = render(<GitHubRepoChooser {...initial} />);
  await user.type(view.getByRole("searchbox"), "harbor");
  await user.click(view.getByTestId("repository-toggle-visible"));
  expect(initial.onToggle).toHaveBeenCalledExactlyOnceWith(
    repos[1].full_name,
    true,
  );
  view.rerender(
    <GitHubRepoChooser
      {...initial}
      selectedNames={repos.map((r) => r.full_name)}
    />,
  );
  await user.click(view.getByTestId("repository-toggle-visible"));
  expect(initial.onToggle).toHaveBeenLastCalledWith(repos[1].full_name, false);
  expect(initial.onProceed).not.toHaveBeenCalled();
});
