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
    checkout: { phase: "idle" },
    onToggle: vi.fn(),
    onProceed: vi.fn(),
    onRecheck: vi.fn(),
  };
}
describe("GitHub first-use chooser", () => {
  it("shows the server and three stages, with all repos visible until filtering is chosen", async () => {
    const user = userEvent.setup();
    const view = render(<GitHubRepoChooser {...props()} />);
    expect(
      view.getByRole("list", { name: "Käyttöönoton vaiheet" }),
    ).toBeTruthy();
    expect(view.getByText(window.location.host)).toBeTruthy();
    expect(view.getByText("sample-lab/aurora")).toBeTruthy();
    expect(view.getByText("sample-lab/harbor")).toBeTruthy();
    await user.selectOptions(
      view.getByRole("combobox", { name: "Aikaväli" }),
      "7",
    );
    expect(view.getByRole("combobox", { name: "Aikaväli" })).toBeTruthy();
    expect(view.queryByText("sample-lab/aurora")).toBeNull();
    // An unknown update time is not grounds to hide a repository.
    expect(view.getByText("sample-lab/harbor")).toBeTruthy();
    await user.selectOptions(
      view.getByRole("combobox", { name: "Aikaväli" }),
      "0",
    );
    expect(view.getByText("sample-lab/aurora")).toBeTruthy();
  });
  it("filters names without writing, then sends exactly the controlled names once", async () => {
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
    expect(view.getByText(/hakee ne työtiloiksi/)).toBeTruthy();
    await user.click(checkbox);
    expect(initial.onToggle).toHaveBeenCalledWith(repos[0].full_name, true);
    expect(initial.onProceed).not.toHaveBeenCalled();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    const selected = { ...initial, selectedNames: [repos[0].full_name] };
    view.rerender(<GitHubRepoChooser {...selected} />);
    await user.type(view.getByRole("searchbox"), "HARBOR");
    expect(view.queryByText("sample-lab/aurora")).toBeNull();
    expect(view.getByText("sample-lab/harbor")).toBeTruthy();
    expect(view.getByText("Viimeksi päivitetty: Ei tiedossa")).toBeTruthy();
    await user.clear(view.getByRole("searchbox"));
    expect(view.getByText(/Viimeksi päivitetty: 28.9.2026/)).toBeTruthy();
    expect(initial.onProceed).not.toHaveBeenCalled();
    await user.click(view.getByRole("button", { name: "Hae 1 repo ja jatka" }));
    expect(initial.onProceed).toHaveBeenCalledExactlyOnceWith([
      repos[0].full_name,
    ]);
    expect(
      (
        view.getByRole("checkbox", {
          name: /sample-lab\/aurora/,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      view
        .getByRole("button", { name: "Hae 1 repo ja jatka" })
        .hasAttribute("disabled"),
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
        view={{ phase: "catalog", repositories: [] }}
      />,
    );
    await user.click(view.getByRole("button", { name: "Jatka ilman repoja" }));
    expect(initial.onProceed).toHaveBeenCalledExactlyOnceWith([]);
    view.unmount();
    const noAuth = render(
      <GitHubRepoChooser {...initial} view={{ phase: "no-auth" }} />,
    );
    await user.click(
      noAuth.getByRole("button", { name: "Jatka ilman repoja" }),
    );
    expect(initial.onProceed).toHaveBeenCalledTimes(2);
    expect(initial.onProceed).toHaveBeenLastCalledWith([]);
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
    expect(view.getByText(/Yhdistetään/)).toBeTruthy();
    expect(
      view.getByText(repos[0].full_name, { selector: "p code" }),
    ).toBeTruthy();
    expect(view.queryByRole("button", { name: /jatka/i })).toBeNull();
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
      expect(view.queryByRole("button", { name: /jatka/i })).toBeNull();
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
    expect(view.getByText("Valittu 1 repo.")).toBeTruthy();
    expect(view.getByText(/Siirrytään ChatGPT-kirjautumiseen/)).toBeTruthy();
    expect(view.queryByRole("button", { name: /jatka/i })).toBeNull();
  });

  it("offers catalog refresh on failure, but no write without a known catalog", async () => {
    const user = userEvent.setup();
    const initial = { ...props(), onRefresh: vi.fn() };
    const view = render(
      <GitHubRepoChooser {...initial} view={{ phase: "loading" }} />,
    );
    expect(view.getByText(/Haetaan GitHub-repoja/)).toBeTruthy();
    expect(view.queryByRole("button", { name: /jatka/i })).toBeNull();
    view.rerender(
      <GitHubRepoChooser {...initial} view={{ phase: "unavailable" }} />,
    );
    await user.click(view.getByRole("button", { name: "Tarkista uudelleen" }));
    expect(initial.onRefresh).toHaveBeenCalledOnce();
    expect(initial.onProceed).not.toHaveBeenCalled();
  });
});

it("rounds transferred bytes and shows a known total without implying an ETA", () => {
  const initial = props();
  const view = render(
    <GitHubRepoChooser
      {...initial}
      selectedNames={[repos[0].full_name]}
      checkout={{
        phase: "progress",
        completed: 0,
        total: 1,
        stage: "receiving",
        percent: 22,
        receivedBytes: 1310720,
        totalBytes: 10485760,
      }}
    />,
  );
  expect(view.getByText(/Haetaan 22 %/)).toBeTruthy();
  expect(view.getByText(/1,3 MiB \/ 10 MiB/)).toBeTruthy();
  expect(view.getByText(/Haettu 0\/1 repoa/)).toBeTruthy();
});

it("bulk-selects only visible repos and preserves hidden selections", async () => {
  const user = userEvent.setup();
  const initial = { ...props(), selectedNames: [repos[0].full_name] };
  const view = render(<GitHubRepoChooser {...initial} />);
  await user.type(view.getByRole("searchbox"), "harbor");
  await user.click(
    view.getByRole("button", { name: "Valitse kaikki näkyvät" }),
  );
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
  await user.click(
    view.getByRole("button", { name: "Poista näkyvien valinnat" }),
  );
  expect(initial.onToggle).toHaveBeenLastCalledWith(repos[1].full_name, false);
  expect(initial.onProceed).not.toHaveBeenCalled();
});
