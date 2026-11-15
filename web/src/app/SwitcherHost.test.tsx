import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RailNow } from "./railNow";
import {
  resetSwitcherForTests,
  SwitcherHost,
  switcherKeyEvent,
} from "./SwitcherHost";
import { clearSearchJump, searchJumpNow } from "./searchJump";
import type { Snapshot } from "./snapshot";

const A = "pi:11111111-1111-4111-8111-111111111111";
const B = "pi:22222222-2222-4222-8222-222222222222";
const C = "pi:33333333-3333-4333-8333-333333333333";

const agent = (agent_id: string, title: string, changed_at: string) => ({
  agent_id,
  workspace_id: "ws_example123",
  changed_at,
  history: "readable" as const,
  process: "not_observed",
  control: "read_only",
  title: { display: title, source: "generated" as const },
  live_tail: [],
  archive: "active" as const,
  capabilities: { agent_resume: { state: "supported", reason_code: "" } },
});

const snapshot = {
  workspaces: [
    {
      workspace_id: "ws_example123",
      name: "retkiopas",
      presence: "present",
      visibility: "visible",
    },
  ],
  agents: [
    agent(A, "Karttatiilten välimuisti", "2026-11-15T10:00:00Z"),
    agent(B, "Kuittien luokittelu", "2026-11-14T10:00:00Z"),
    agent(C, "Aukioloajat", "2026-11-13T10:00:00Z"),
  ],
} as unknown as Snapshot;
const now: RailNow = { yours: [], running: [], quiet: [], hints: new Map() };

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

const reply = {
  schema_version: 1,
  terms: ["kart"],
  index: { state: "ready", indexed: 3, total: 3 },
  conversations: [
    {
      agent_id: B,
      hit_count: 2,
      hits: [
        {
          entry_key: "b1",
          role: "assistant",
          at: "2026-11-14T09:00:00Z",
          snippet: "Kartan mukaan kuitit.",
        },
        {
          entry_key: "b2",
          role: "user",
          at: "2026-11-14T08:00:00Z",
          snippet: "Tilikartta kuntoon.",
        },
      ],
    },
  ],
};

beforeEach(() => {
  resetSwitcherForTests();
  clearSearchJump();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(reply), {
          headers: { "content-type": "application/json" },
        }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

function mount(current = A) {
  return render(
    <MemoryRouter
      initialEntries={[`/workspaces/ws_example123?conversation=${current}`]}
    >
      <SwitcherHost
        snapshot={snapshot}
        daemonSessions={[]}
        now={now}
        current={current}
        onLogin={() => {}}
      />
      <Where />
    </MemoryRouter>,
  );
}

it("takes ⌘K on a Mac and Ctrl+K elsewhere, by key position", () => {
  const key = (init: KeyboardEventInit) =>
    new KeyboardEvent("keydown", { code: "KeyK", ...init });
  expect(switcherKeyEvent(key({ metaKey: true }), true)).toBe(true);
  expect(switcherKeyEvent(key({ ctrlKey: true }), true)).toBe(false);
  expect(switcherKeyEvent(key({ ctrlKey: true }), false)).toBe(true);
  expect(switcherKeyEvent(key({ metaKey: true }), false)).toBe(false);
  expect(switcherKeyEvent(key({ ctrlKey: true, shiftKey: true }), false)).toBe(
    false,
  );
});

it("opens on Ctrl+K with the recent list, and / only outside text fields", () => {
  mount();
  fireEvent.keyDown(window, { code: "KeyK", key: "k", ctrlKey: true });
  expect(screen.getByTestId("switcher")).toBeTruthy();
  // The open conversation is not offered; the others are, newest first.
  expect(screen.queryByTestId(`switcher-row-c-${A}`)).toBeNull();
  expect(
    screen.getByTestId(`switcher-row-c-${B}`).getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.keyDown(window, { code: "KeyK", key: "k", ctrlKey: true });
  expect(screen.queryByTestId("switcher")).toBeNull();
  const field = document.createElement("textarea");
  document.body.append(field);
  field.focus();
  fireEvent.keyDown(field, { key: "/", code: "Slash" });
  expect(screen.queryByTestId("switcher")).toBeNull();
  field.remove();
  fireEvent.keyDown(document.body, { key: "/", code: "Slash" });
  expect(screen.getByTestId("switcher")).toBeTruthy();
});

it("leaves Ctrl+K to the terminal", () => {
  mount();
  const terminal = document.createElement("div");
  terminal.className = "ah-terminal-surface";
  terminal.tabIndex = 0;
  document.body.append(terminal);
  fireEvent.keyDown(terminal, { code: "KeyK", key: "k", ctrlKey: true });
  expect(screen.queryByTestId("switcher")).toBeNull();
  terminal.remove();
});

it("finds names at once, adds message hits, and Enter jumps to the shown sentence", async () => {
  mount();
  fireEvent.keyDown(window, { code: "KeyK", key: "k", ctrlKey: true });
  fireEvent.change(screen.getByTestId("switcher-input"), {
    target: { value: "kartta" },
  });
  // The name match is there before the daemon answers.
  expect(screen.getByTestId(`switcher-row-c-${A}`)).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByTestId(`switcher-row-c-${B}`)).toBeTruthy(),
  );
  expect(
    (fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0],
  ).toBe("/api/v1/search?q=kartta");
  const rows = screen.getAllByRole("option").map((o) => o.dataset.testid);
  expect(rows).toEqual([`switcher-row-c-${A}`, `switcher-row-c-${B}`]);
  expect(screen.getByTestId(`switcher-row-c-${B}`).textContent).toContain(
    "Kartan mukaan kuitit.",
  );
  const input = screen.getByTestId("switcher-input");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowRight" });
  expect(screen.getByTestId(`switcher-row-h-${B}-b2`)).toBeTruthy();
  fireEvent.keyDown(input, { key: "ArrowLeft" });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
  expect(screen.queryByTestId("switcher")).toBeNull();
  expect(screen.getByTestId("where").textContent).toBe(
    `/workspaces/ws_example123?conversation=${B}`,
  );
  expect(searchJumpNow()).toMatchObject({
    agentId: B,
    entryKey: "b1",
    query: "kartta",
    terms: ["kart"],
  });
});

it("offers Continue search after a jump, and an empty query swaps two", async () => {
  const view = mount(A);
  fireEvent.keyDown(window, { code: "KeyK", key: "k", ctrlKey: true });
  fireEvent.change(screen.getByTestId("switcher-input"), {
    target: { value: "kartta" },
  });
  await waitFor(() =>
    expect(screen.getByTestId(`switcher-row-c-${B}`)).toBeTruthy(),
  );
  fireEvent.keyDown(screen.getByTestId("switcher-input"), { key: "ArrowDown" });
  await act(async () => {
    fireEvent.keyDown(screen.getByTestId("switcher-input"), { key: "Enter" });
  });
  view.rerender(
    <MemoryRouter
      initialEntries={[`/workspaces/ws_example123?conversation=${B}`]}
    >
      <SwitcherHost
        snapshot={snapshot}
        daemonSessions={[]}
        now={now}
        current={B}
        onLogin={() => {}}
      />
      <Where />
    </MemoryRouter>,
  );
  fireEvent.keyDown(window, { code: "KeyK", key: "k", ctrlKey: true });
  // The previous conversation is chosen, so ⌘K Enter swaps back.
  expect(
    screen.getByTestId(`switcher-row-c-${A}`).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByTestId(`switcher-row-c-${A}`).textContent).toContain(
    "edellinen",
  );
  expect(screen.getByTestId("switcher-row-continue").textContent).toContain(
    "kartta",
  );
});
