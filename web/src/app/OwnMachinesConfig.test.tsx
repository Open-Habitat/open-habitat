import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import example from "../../../contracts/v1/examples/own-machines.json";
import { OwnMachines } from "./OwnMachines";
import { configGroups, missingKey, type SSHConfig } from "./ownMachines";

// The ~/.ssh/config hosts behind own-machines-ssh-config. The switch is
// the account preference the provider reads; here it is set directly.
const feature = vi.hoisted(() => ({ on: false }));
vi.mock("./accountPreferences", async (actual) => ({
  ...(await actual<typeof import("./accountPreferences")>()),
  useExperimentalFeature: () => feature.on,
}));

beforeEach(() => {
  feature.on = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const config = example.ssh_config as SSHConfig;

/** A daemon that answers reads with the example and applies choices. */
function daemon() {
  let current = structuredClone(example) as typeof example & {
    config_check?: unknown;
  };
  const posts: Record<string, string>[] = [];
  const fetch = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method !== "POST") {
      const { config_check: _, ...read } = current;
      return Promise.resolve(Response.json(read));
    }
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    posts.push(body);
    const c = current.ssh_config as SSHConfig;
    const without = (l: string[]) => l.filter((a) => a !== body.alias);
    if (body.action === "config_show") {
      c.shown = [...without(c.shown), body.alias];
      c.hidden = without(c.hidden);
    } else if (body.action === "config_hide") {
      c.shown = without(c.shown);
      c.hidden = [...without(c.hidden), body.alias];
    } else if (body.action === "config_unshow") c.shown = without(c.shown);
    current = {
      ...current,
      config_check:
        body.action === "config_check"
          ? { alias: body.alias, result: "offline" }
          : undefined,
    };
    if (!current.config_check) delete current.config_check;
    return Promise.resolve(Response.json(current));
  });
  vi.stubGlobal("fetch", fetch);
  return { posts, fetch };
}

it("shows nothing of ~/.ssh/config while the feature is off", async () => {
  daemon();
  const view = render(<OwnMachines csrf="fixture-csrf" />);
  await view.findByTestId("own-machines");
  expect(view.queryByTestId("found-group")).toBeNull();
  expect(view.queryByTestId("config-machine")).toBeNull();
});

it("groups the found hosts, shows one as a machine and checks only on request", async () => {
  feature.on = true;
  const { posts } = daemon();
  const view = render(<OwnMachines csrf="fixture-csrf" />);
  const group = await view.findByTestId("found-group");
  // The shown host is a card in the machine list, not a row of the group.
  const list = view.container.querySelector(
    '[data-settings-row="own-machines"]',
  ) as HTMLElement;
  expect(
    within(list)
      .getAllByTestId("config-machine")
      .map((c) => c.dataset.machine),
  ).toEqual(["nas"]);
  expect(
    within(group)
      .getAllByTestId("found-host")
      .map((r) => r.dataset.host),
  ).toEqual(["build"]);
  // Opening the page sends nothing: no host is checked by itself.
  expect(posts).toEqual([]);
  expect(within(list).getByTestId("config-machine").dataset.state).toBe(
    "unchecked",
  );

  await userEvent.click(within(group).getByTestId("found-adopt"));
  await waitFor(() =>
    expect(within(list).getAllByTestId("config-machine")).toHaveLength(2),
  );
  expect(posts).toEqual([{ action: "config_show", alias: "build" }]);
  expect(within(group).getByTestId("found-none")).toBeTruthy();

  const build = list.querySelector(
    '[data-testid="config-machine"][data-machine="build"]',
  ) as HTMLElement;
  await userEvent.click(within(build).getByTestId("config-check"));
  await waitFor(() => expect(build.dataset.state).toBe("offline"));
  expect(posts.at(-1)).toEqual({ action: "config_check", alias: "build" });
  // The other card keeps its own state.
  expect(
    (
      list.querySelector(
        '[data-testid="config-machine"][data-machine="nas"]',
      ) as HTMLElement
    ).dataset.state,
  ).toBe("unchecked");

  await userEvent.click(within(build).getByTestId("config-remove"));
  await waitFor(() =>
    expect(within(group).getAllByTestId("found-host")).toHaveLength(1),
  );
  expect(posts.at(-1)).toEqual({ action: "config_unshow", alias: "build" });
});

it("says an empty and an unreadable config", async () => {
  feature.on = true;
  for (const state of ["empty", "unreadable"] as const) {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            ...example,
            ssh_config: { ...config, state, hosts: [], shown: [] },
          }),
        ),
      ),
    );
    const view = render(<OwnMachines csrf="fixture-csrf" />);
    await view.findByTestId(`config-${state}`);
    expect(view.queryByTestId("found-host")).toBeNull();
    cleanup();
  }
});

it("groups only the aliases the file has now", () => {
  const groups = configGroups({
    ...config,
    shown: ["nas", "gone"],
    hidden: ["build", "also-gone"],
  });
  expect(groups.shown.map((h) => h.alias)).toEqual(["nas"]);
  expect(groups.hidden.map((h) => h.alias)).toEqual(["build"]);
  expect(groups.found).toEqual([]);
  expect(
    missingKey({
      ...config.hosts[0],
      keys: [
        { path: "~/.ssh/a", present: true },
        { path: "~/.ssh/b", present: false },
      ],
    }),
  ).toBe("~/.ssh/b");
  expect(missingKey(config.hosts[1])).toBeUndefined();
});
