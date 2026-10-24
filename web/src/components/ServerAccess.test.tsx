import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AccessEntry, AccessView } from "../app/serverAccess";
import { ServerAccess } from "./ServerAccess";

const entries: AccessEntry[] = [
  {
    id: "42",
    source: "operator",
    state: "joined",
    username: "alice",
    administrator: true,
    denied: false,
  },
  {
    id: "43",
    source: "site_admin",
    state: "joined",
    username: "bob",
    login_hint: "bob",
    administrator: false,
    denied: false,
  },
  {
    id: "44",
    source: "site_admin",
    state: "allowed",
    login_hint: "carol",
    administrator: false,
    denied: false,
  },
  {
    id: "45",
    source: "site_admin",
    state: "withdrawn",
    username: "dave",
    login_hint: "dave",
    administrator: false,
    denied: true,
  },
  // A withdrawal whose broker reply never came: still admitted, but denied.
  {
    id: "46",
    source: "site_admin",
    state: "joined",
    username: "erin",
    login_hint: "erin",
    administrator: false,
    denied: true,
  },
];
const base: AccessView = {
  schema_version: 1,
  mode: "allowlist",
  runtime_admission: true,
  entries,
};

function setup(props: Partial<Parameters<typeof ServerAccess>[0]> = {}) {
  const calls = {
    lookup: vi.fn(async (login: string) =>
      login.toLowerCase() === "frank"
        ? {
            kind: "found" as const,
            user: { id: "47", login: "frank", name: "Frank Example" },
          }
        : login === "bob"
          ? {
              kind: "found" as const,
              user: { id: "43", login: "bob", name: "Bob Example" },
            }
          : login === "dave"
            ? {
                kind: "found" as const,
                user: { id: "45", login: "dave", name: "Dave Example" },
              }
            : { kind: "refused" as const, code: "github_user_not_found" },
    ),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onRefresh: vi.fn(),
  };
  render(<ServerAccess view={base} {...calls} {...props} />);
  return calls;
}
const row = (id: string) => screen.getByTestId(`access-row-${id}`);
const button = (id: string) => screen.queryByTestId(id);

it("shows each stage and offers only the action that stage allows", () => {
  setup();
  expect(
    ["42", "43", "44", "45", "46"].map((id) => row(id).dataset.state),
  ).toEqual(["joined", "joined", "allowed", "withdrawn", "unfinished"]);
  // Root's site.json entries, administrators included, are not removable.
  expect(within(row("42")).queryByRole("button")).toBeNull();
  expect(button("access-remove-43")).toBeTruthy();
  expect(button("access-remove-44")).toBeTruthy();
  expect(button("access-restore-45")).toBeTruthy();
  expect(button("access-remove-45")).toBeNull();
  // An unconfirmed withdrawal can be sent again.
  expect(button("access-remove-46")).toBeTruthy();
  // The administrator role is read-only here.
  expect(screen.queryByTestId("account-role-toggle")).toBeNull();
});

it("labels a row by its login, never by the numeric id", () => {
  setup();
  const named = screen.getByTestId("access-login-43");
  expect(named.textContent).toContain("bob");
  expect(named.textContent).not.toContain("43");
  // Root's row came without a login: it is marked unnamed, and the id is a
  // fact beside it rather than its label.
  const unnamed = screen.getByTestId("access-login-42");
  expect(unnamed.dataset.unnamed).toBeDefined();
  expect(unnamed.textContent).not.toContain("42");
  expect(row("42").textContent).toContain("42");
});

it("filters by stage", () => {
  setup();
  fireEvent.click(
    within(screen.getByTestId("access-filter")).getByTestId(
      "segment-withdrawn",
    ),
  );
  expect(
    screen
      .getAllByTestId(/^access-row-/)
      .map((r) => r.dataset.testid?.slice(11)),
  ).toEqual(["45"]);
});

it("keeps a change in flight on screen whatever the filter", () => {
  setup({
    pending: {
      "47": { kind: "uncertain", login: "frank" },
      "44": { kind: "remove", login: "carol" },
    },
  });
  fireEvent.click(
    within(screen.getByTestId("access-filter")).getByTestId("segment-joined"),
  );
  expect(
    screen
      .getAllByTestId(/^access-row-/)
      .map((r) => r.dataset.testid?.slice(11)),
  ).toEqual(["42", "43", "44", "46", "47"]);
  expect(screen.getByTestId("access-refresh-47")).toBeTruthy();
});

it("checks a login on GitHub before allowing it, then hands over the numeric id", async () => {
  const calls = setup();
  const input = screen.getByTestId("access-login-input");
  fireEvent.change(input, {
    target: { value: "https://github.com/Frank" },
  });
  fireEvent.click(screen.getByTestId("access-add"));
  expect(calls.lookup).toHaveBeenCalledWith("Frank");
  await vi.waitFor(() =>
    expect(screen.getByTestId("access-check").dataset.kind).toBe("found"),
  );
  expect(screen.getByTestId("access-check").textContent).toContain("47");
  expect(calls.onAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("access-add"));
  expect(calls.onAdd).toHaveBeenCalledWith(
    { id: "47", login: "frank", name: "Frank Example" },
    false,
  );
});

it("reports a duplicate under the field by numeric id and offers restore for a withdrawn one", async () => {
  const calls = setup();
  const input = screen.getByTestId("access-login-input");
  const check = () => screen.getByTestId("access-check").dataset.kind;
  fireEvent.change(input, { target: { value: "@bob" } });
  fireEvent.click(screen.getByTestId("access-add"));
  await vi.waitFor(() => expect(check()).toBe("duplicate"));
  expect(screen.getByTestId("access-add")).toHaveProperty("disabled", true);
  fireEvent.change(input, { target: { value: "dave" } });
  fireEvent.click(screen.getByTestId("access-add"));
  await vi.waitFor(() => expect(check()).toBe("restore"));
  fireEvent.click(screen.getByTestId("access-add"));
  expect(calls.onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ id: "45" }),
    true,
  );
  fireEvent.change(input, { target: { value: "nobody" } });
  fireEvent.click(screen.getByTestId("access-add"));
  await vi.waitFor(() => expect(check()).toBe("problem"));
  fireEvent.change(input, { target: { value: "-bad-" } });
  fireEvent.click(screen.getByTestId("access-add"));
  expect(check()).toBe("invalid");
  expect(calls.lookup).toHaveBeenCalledTimes(3);
});

it("drops a lookup answer that arrives after the login changed", async () => {
  let answer: (v: unknown) => void = () => {};
  const lookup = vi.fn(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }) as never,
  );
  setup({ lookup });
  const input = screen.getByTestId("access-login-input");
  fireEvent.change(input, { target: { value: "frank" } });
  fireEvent.click(screen.getByTestId("access-add"));
  fireEvent.change(input, { target: { value: "fran" } });
  answer({
    kind: "found",
    user: { id: "47", login: "frank", name: "Frank Example" },
  });
  await Promise.resolve();
  expect(screen.getByTestId("access-check").dataset.kind).toBe("idle");
});

it("confirms a removal before sending it", () => {
  const calls = setup();
  fireEvent.click(screen.getByTestId("access-remove-43"));
  expect(calls.onRemove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("access-remove-confirm"));
  expect(calls.onRemove).toHaveBeenCalledWith(
    expect.objectContaining({ id: "43" }),
  );
});

it("marks a waiting change and an uncertain one, and shows a new id before the broker lists it", () => {
  const calls = setup({
    pending: {
      "43": { kind: "remove" },
      "47": { kind: "add", login: "frank", name: "Frank Example" },
      "44": { kind: "uncertain" },
    },
  });
  expect(row("43").dataset.pending).toBe("remove");
  expect(button("access-remove-43")).toHaveProperty("disabled", true);
  expect(row("47").dataset.pending).toBe("add");
  expect(row("47").textContent).toContain("frank");
  expect(row("44").dataset.pending).toBe("uncertain");
  expect(button("access-remove-44")).toBeNull();
  fireEvent.click(screen.getByTestId("access-refresh-44"));
  expect(calls.onRefresh).toHaveBeenCalled();
});

it("disables adding and restoring while root's runtime switch is off, but keeps removal", () => {
  setup({ view: { ...base, runtime_admission: false } });
  expect(screen.getByTestId("access-login-input")).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByTestId("access-check").dataset.kind).toBe("disabled");
  expect(button("access-restore-45")).toHaveProperty("disabled", true);
  expect(button("access-remove-43")).toHaveProperty("disabled", false);
});

it("in open mode says so and offers neither adding nor removal", () => {
  setup({ view: { ...base, mode: "any" } });
  expect(screen.getByTestId("access-open")).toBeTruthy();
  expect(screen.queryByTestId("access-login-input")).toBeNull();
  for (const b of screen.queryAllByTestId(/^access-(remove|restore)-/))
    expect(b).toHaveProperty("disabled", true);
});

it("names only the defaults a sign-in did not hand over", () => {
  const onboarding: AccessEntry["onboarding"] = {
    at: "2026-10-24T09:00:00Z",
    mode: "auto",
    defaults: [
      { repository: "acme/team", outcome: "queued" },
      { repository: "acme/docs", outcome: "already_present" },
      { repository: "acme/infra", outcome: "no_access" },
      { repository: "acme/slow", outcome: "check_failed" },
      { repository: "acme/lost", outcome: "unknown" },
    ],
    ai_key: "not_offered",
  };
  setup({
    view: {
      ...base,
      entries: entries.map((e) => (e.id === "43" ? { ...e, onboarding } : e)),
    },
  });
  const receipt = screen.getByTestId("access-onboarding-43");
  const named = (outcome: string) =>
    [...receipt.querySelectorAll(`[data-outcome="${outcome}"] code`)].map(
      (c) => c.textContent,
    );
  expect(named("no_access")).toEqual(["acme/infra"]);
  expect(named("check_failed")).toEqual(["acme/slow"]);
  expect(named("unknown")).toEqual(["acme/lost"]);
  // Handed-over defaults are counted, not listed; a key not offered is not
  // mentioned.
  expect(receipt.textContent).not.toContain("acme/team");
  expect(receipt.textContent).not.toContain("acme/docs");
  expect(receipt.querySelector('[data-outcome^="ai_"]')).toBeNull();
  // A person who joined without a receipt shows none.
  expect(screen.queryByTestId("access-onboarding-42")).toBeNull();
});

it("names a site key copy the site gave, and whether it is an earlier key", () => {
  const view: AccessView = {
    ...base,
    entries: entries.map((e) =>
      e.id === "43"
        ? {
            ...e,
            site_key_copy: {
              provider: "anthropic",
              suffix: "m4Pz",
              at: "2026-10-21T12:00:00Z",
              current: false,
            },
          }
        : e,
    ),
  };
  render(
    <ServerAccess
      view={view}
      lookup={vi.fn()}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
  expect(screen.getByTestId("access-ai-given-43").textContent).toBe(
    "AI-avain annettu 21.10. (aiempi avain)",
  );
  expect(screen.queryByTestId("access-ai-given-42")).toBeNull();
});
