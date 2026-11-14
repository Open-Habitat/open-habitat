import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { preferredWorkspace, StorageBreakdown } from "./StorageBreakdown";
import type { BreakdownItem } from "./storageBreakdown";

afterEach(() => vi.restoreAllMocks());

const G = 1024 ** 3;
const items: BreakdownItem[] = [
  {
    group: "caches",
    kind: "go-build",
    path: "~/.cache/go-build",
    bytes: 20 * G,
    complete: true,
  },
  {
    group: "caches",
    kind: "npm",
    path: "~/.npm/_cacache",
    bytes: 3 * G,
    complete: true,
  },
  {
    group: "finished",
    kind: "target",
    path: "~/src/app__worktrees/wt-old/target",
    bytes: 9 * G,
    complete: true,
    workspace: "app__worktrees",
    run_id: "01m7cccccccccccccccccccccc",
    title: "Old search",
  },
  {
    group: "live",
    kind: "target",
    path: "~/src/app__worktrees/wt-new/target",
    bytes: 14 * G,
    complete: false,
    workspace: "app__worktrees",
    run_id: "01m7aaaaaaaaaaaaaaaaaaaaaa",
    title: "Calendar",
  },
  {
    group: "own",
    kind: "node_modules",
    path: "~/src/site/node_modules",
    bytes: 1 * G,
    complete: true,
    workspace: "site",
  },
  {
    group: "trash",
    kind: "trash",
    path: "~/.local/share/Trash",
    bytes: 4 * G,
    complete: true,
  },
  {
    group: "workspaces",
    kind: "workspace",
    path: "~/src/app",
    bytes: 30 * G,
    complete: true,
    workspace: "app",
  },
];
const quota = {
  limits: "enforced" as const,
  usage_bytes: 115 * G,
  limit_bytes: 128 * G,
};
const workspaces = [
  { workspace_id: "ws_site", name: "site" },
  { workspace_id: "ws_app", name: "app" },
];

function reply(body: object) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}
const measured = {
  schema_version: 1,
  measuring: false,
  measured_at: "2030-01-01T09:12:00Z",
  complete: true,
  items,
};

it("previews the default selection against the limit and the 85 % line", async () => {
  const fetchMock = reply(measured);
  render(
    <StorageBreakdown
      quota={quota}
      workspaces={workspaces}
      onAskAgent={() => true}
    />,
  );
  await screen.findByTestId("group-list");
  expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/account/storage/breakdown");
  // Caches and finished work are chosen; own builds and live work are not.
  expect(screen.getByTestId("frees").textContent).toContain("32");
  expect(screen.getByTestId("after").textContent).toContain(
    "83 GiB / 128 GiB · 64 %",
  );
  expect(screen.getByTestId("verdict").dataset.ok).toBe("true");
  expect(screen.getByTestId("storage-warning").textContent).toContain("89 %");
  const live = screen
    .getByTestId("group-list")
    .querySelector('[data-group-row="live"]');
  expect(
    (within(live as HTMLElement).getByRole("checkbox") as HTMLInputElement)
      .disabled,
  ).toBe(true);
  // Paths are behind "Näytä tarkemmin".
  expect(screen.queryByText("~/.cache/go-build")).toBeNull();
  fireEvent.click(screen.getByTestId("more-caches"));
  expect(screen.getByText("~/.cache/go-build")).toBeTruthy();
  // The bar has the chosen part last; the Trash has its own row.
  const parts = [...screen.getByTestId("usage-bar").children].map(
    (p) => (p as HTMLElement).dataset.part,
  );
  expect(parts.at(-1)).toBe("chosen");
  expect(screen.getByTestId("trash-below")).toBeTruthy();
});

it("moves the preview when a group is left out", async () => {
  reply(measured);
  render(
    <StorageBreakdown
      quota={quota}
      workspaces={workspaces}
      onAskAgent={() => true}
    />,
  );
  await screen.findByTestId("group-list");
  fireEvent.click(
    screen.getByTestId("group-caches").querySelector("input") ??
      screen.getByTestId("group-caches"),
  );
  expect(screen.getByTestId("frees").textContent).toContain("9");
  expect(screen.getByTestId("after").textContent).toContain("· 82 %");
});

it("opens a new conversation with the request built from the selection", async () => {
  reply(measured);
  const ask = vi.fn((_ws: string, _text: string) => true);
  render(
    <StorageBreakdown quota={quota} workspaces={workspaces} onAskAgent={ask} />,
  );
  await screen.findByTestId("group-list");
  fireEvent.click(screen.getByTestId("cleanup-ask"));
  expect(ask).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  const text = ask.mock.calls[0][1];
  expect(text).toContain("~/.cache/go-build (20 GiB): go clean -cache");
  expect(text).toContain(
    "~/src/app__worktrees/wt-old/target (9 GiB): cargo clean",
  );
  expect(text).not.toContain("~/src/site/node_modules");
  expect(text).toContain(
    "Älä koske käynnissä olevien workerien hakemistoihin:\n- ~/src/app__worktrees/wt-new/target",
  );
  // The workspace with the largest build directories is preselected.
  expect(ask).toHaveBeenCalledWith("ws_app", text);
});

it("asks the agent to find caches itself before the first measurement", async () => {
  reply({ schema_version: 1, measuring: true, complete: false, items: [] });
  const ask = vi.fn((_ws: string, _text: string) => true);
  render(
    <StorageBreakdown quota={quota} workspaces={workspaces} onAskAgent={ask} />,
  );
  expect((await screen.findByTestId("measured")).textContent).toContain(
    "ensimmäistä kertaa",
  );
  expect(screen.queryByTestId("group-list")).toBeNull();
  fireEvent.click(screen.getByTestId("cleanup-ask"));
  const text = ask.mock.calls[0][1];
  expect(text).toContain(
    "Etsi kotihakemistostani uudelleen luotavat välimuistit",
  );
});

it("keeps known data out of other and out of the cleanup selection", async () => {
  const groups = [
    "dropbox",
    "onedrive",
    "offered",
    "history",
    "workspaces",
  ] as const;
  const data = groups.map((group, i) => ({
    group,
    kind: group === "workspaces" ? "workspace" : group,
    path: `~/data/${group}`,
    bytes: (i + 1) * G,
    complete: true,
  }));
  reply({
    ...measured,
    items: [...data, items[0], { ...items[5], bytes: 0 }],
  });
  render(<StorageBreakdown quota={quota} />);
  await screen.findByTestId("group-list");
  for (const g of groups) {
    const part = screen
      .getByTestId("usage-bar")
      .querySelector(`[data-part="${g}"]`);
    expect(part).not.toBeNull();
    fireEvent.click(screen.getByTestId(`more-${g}`));
    expect(screen.getByText(`~/data/${g}`)).toBeTruthy();
    expect(
      within(
        screen.getByText(`~/data/${g}`).closest("li") as HTMLElement,
      ).queryByRole("checkbox"),
    ).toBeNull();
  }
  expect(
    screen
      .getByTestId("usage-bar")
      .querySelector<HTMLElement>('[data-part="kept"]')?.style.width,
  ).toBe("62.5%");
  expect(
    screen.getByTestId("group-list").querySelector('[data-group-row="trash"]')
      ?.textContent,
  ).toContain("0 B");
  expect(
    screen.getByTestId("usage-bar").querySelector('[data-part="trash"]'),
  ).toBeNull();
});

it("prefers the workspace holding the largest build directories", () => {
  expect(preferredWorkspace(workspaces, items)).toBe("ws_app");
  expect(preferredWorkspace(workspaces, [])).toBe("ws_site");
  expect(preferredWorkspace([], items)).toBeUndefined();
});
