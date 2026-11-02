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
  teams: [],
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

it("checks several logins one by one and allows those that can be allowed", async () => {
  const lookup = vi.fn(async (login: string) =>
    login === "frank"
      ? {
          kind: "found" as const,
          user: { id: "47", login: "frank", name: "Frank Example" },
        }
      : login === "Frank-Alias"
        ? {
            kind: "found" as const,
            user: { id: "47", login: "frank", name: "Frank Example" },
          }
        : login === "gina"
          ? {
              kind: "found" as const,
              user: { id: "48", login: "gina", name: "" },
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
              : login === "acme"
                ? { kind: "refused" as const, code: "github_not_user" }
                : { kind: "refused" as const, code: "github_user_not_found" },
  );
  const onAdd = vi.fn(async (user: { id: string }, _restore: boolean) =>
    user.id === "48"
      ? { kind: "refused" as const, text: "Sallittujen lista on täynnä." }
      : { kind: "changed" as const },
  );
  setup({ lookup, onAdd });
  fireEvent.change(screen.getByTestId("access-login-input"), {
    target: {
      value:
        "frank, @bob\nnobody acme,-bad- https://github.com/dave FRANK Frank-Alias\ngina",
    },
  });
  fireEvent.click(screen.getByTestId("access-add"));
  const items = () =>
    Object.fromEntries(
      screen
        .getAllByTestId("access-batch-item")
        .map((i) => [i.dataset.login, i.dataset.kind]),
    );
  await vi.waitFor(() =>
    expect(items()).toEqual({
      frank: "found",
      bob: "duplicate",
      nobody: "problem",
      acme: "problem",
      "-bad-": "invalid",
      dave: "restore",
      "Frank-Alias": "duplicate",
      gina: "found",
    }),
  );
  // A repeat of the same login is dropped; a shape-invalid one is never
  // looked up.
  expect(lookup.mock.calls.map(([l]) => l)).toEqual([
    "frank",
    "bob",
    "nobody",
    "acme",
    "dave",
    "Frank-Alias",
    "gina",
  ]);
  const text = (login: string) =>
    screen
      .getAllByTestId("access-batch-item")
      .find((i) => i.dataset.login === login)?.textContent;
  expect(text("acme")).toContain("Tunnus ei ole henkilön GitHub-tili.");
  expect(text("nobody")).toContain("GitHub-käyttäjää ei löydy.");
  expect(text("bob")).toContain("On jo käyttäjä");
  expect(text("Frank-Alias")).toContain("Sama tili kuin @frank.");
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByTestId("access-add").textContent).toBe("Salli 3");
  fireEvent.click(screen.getByTestId("access-add"));
  await vi.waitFor(() =>
    expect(items()).toMatchObject({
      frank: "added",
      dave: "restored",
      gina: "refused",
    }),
  );
  expect(onAdd.mock.calls.map(([u, r]) => [u.id, r])).toEqual([
    ["47", false],
    ["45", true],
    ["48", false],
  ]);
  expect(text("gina")).toContain("Sallittujen lista on täynnä.");
  expect(
    (screen.getByTestId("access-login-input") as HTMLTextAreaElement).value,
  ).toBe("");
});

it("stops checking several logins when the field changes", async () => {
  let answer: (v: unknown) => void = () => {};
  const lookup = vi.fn(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }) as never,
  );
  setup({ lookup });
  const input = screen.getByTestId("access-login-input");
  fireEvent.change(input, { target: { value: "frank gina" } });
  fireEvent.click(screen.getByTestId("access-add"));
  fireEvent.change(input, { target: { value: "frank" } });
  answer({
    kind: "found",
    user: { id: "47", login: "frank", name: "Frank Example" },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("access-check").dataset.kind).toBe("idle");
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

it("names an admitted person administrator after confirming, and revokes only a designation", () => {
  const onRole = vi.fn();
  setup({
    onRole,
    view: {
      ...base,
      entries: [
        {
          ...entries[0],
          administrator_role: { source: "operator", state: "granted" },
        },
        ...entries.slice(1, 3),
        {
          ...entries[3],
          administrator: true,
          administrator_role: {
            source: "site_admin",
            state: "granted",
            actor: "42",
            at: "2026-10-30T08:00:00Z",
          },
        },
        entries[4],
      ],
    },
  });
  // site.json's administrator has no role control; a withdrawal still in
  // doubt is no time to change a role.
  expect(within(row("42")).queryByRole("button")).toBeNull();
  expect(button("access-role-46")).toBeNull();
  // Carol has not signed in: she can be named all the same.
  fireEvent.click(screen.getByTestId("access-role-44"));
  expect(onRole).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("access-grant-confirm"));
  expect(onRole).toHaveBeenCalledWith(
    expect.objectContaining({ id: "44" }),
    true,
  );
  // A designated role is revocable even after the person's access ended.
  fireEvent.click(screen.getByTestId("access-role-45"));
  expect(onRole).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: "45" }),
    false,
  );
});

it("shows a pending designation, and one whose admission is gone", () => {
  setup({
    onRole: vi.fn(),
    view: {
      ...base,
      entries: [
        {
          ...entries[2],
          administrator_role: { source: "site_admin", state: "pending" },
        },
        {
          id: "48",
          source: "none",
          state: "unlisted",
          administrator: false,
          denied: false,
          administrator_role: { source: "site_admin", state: "pending" },
        },
      ],
    },
  });
  expect(row("44").dataset.admin).toBe("pending");
  expect(row("48").dataset.state).toBe("withdrawn");
  expect(button("access-role-48")).toBeTruthy();
  expect(button("access-remove-48")).toBeNull();
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

const teamView: AccessView = {
  ...base,
  teams: [
    {
      org_id: "700",
      org: "Contoso-Power",
      slug: "habitat",
      pinned: true,
      actor: "42",
      at: "2026-11-01T08:00:00Z",
    },
  ],
  entries: [
    ...entries,
    {
      id: "61",
      source: "team",
      state: "joined",
      username: "anna",
      login_hint: "anna",
      at: "2026-11-01T09:00:00Z",
      administrator: false,
      denied: false,
      team_state: "member",
      teams: ["Contoso-Power/habitat"],
    },
    {
      id: "62",
      source: "team",
      state: "left",
      username: "tuuli",
      login_hint: "tuuli",
      at: "2026-11-02T07:00:00Z",
      administrator: false,
      denied: false,
      team_state: "left",
      teams: ["Contoso-Power/habitat"],
    },
    {
      id: "63",
      source: "team",
      state: "unconfirmed",
      username: "lauri",
      login_hint: "lauri",
      at: "2026-11-02T07:00:00Z",
      administrator: false,
      denied: false,
      team_state: "unconfirmed",
      teams: ["Contoso-Power/habitat"],
    },
  ],
};
// Bob is admitted one by one and through the team: two reasons.
teamView.entries = teamView.entries.map((e) =>
  e.id === "43"
    ? { ...e, team_state: "member", teams: ["Contoso-Power/habitat"] }
    : e,
);

it("shows each row's reasons as chips once a team is a source", () => {
  setup({ view: teamView });
  const chips = (id: string) =>
    [...screen.getByTestId(`access-reasons-${id}`).children].map(
      (c) => `${(c as HTMLElement).dataset.kind}:${c.textContent}`,
    );
  expect(chips("42")).toEqual(["server:palvelimen asetukset"]);
  expect(chips("43")).toEqual([
    "individual:henkilönä",
    "team:Contoso-Power/habitat",
  ]);
  expect(chips("61")).toEqual(["team:Contoso-Power/habitat"]);
  expect(chips("62")).toEqual(["left:Contoso-Power/habitat – lähti"]);
  expect(chips("63")).toEqual([
    "unconfirmed:Contoso-Power/habitat – ei vahvistettu",
  ]);
  // A team member can still be removed at once; a leaver is let back in
  // one by one.
  expect(button("access-remove-61")).toBeTruthy();
  expect(row("62").dataset.state).toBe("withdrawn");
  expect(button("access-allow-62")).toBeTruthy();
  expect(button("access-allow-63")).toBeTruthy();
});

it("lists no chips on a site without teams", () => {
  setup();
  expect(screen.queryByTestId("access-reasons-42")).toBeNull();
});

it("raises a leaver as a notice that allows one by one or dismisses", () => {
  const onForget = vi.fn();
  const calls = setup({ view: teamView, onForget });
  const notice = screen.getByTestId("access-leaver-62");
  expect(notice.textContent).toContain(
    "@tuuli lähti tiimistä Contoso-Power/habitat",
  );
  // The unconfirmed member is not called a leaver.
  expect(screen.queryByTestId("access-leaver-63")).toBeNull();
  fireEvent.click(screen.getByTestId("access-leaver-allow-62"));
  expect(calls.onAdd).toHaveBeenCalledWith(
    { id: "62", login: "tuuli", name: "" },
    false,
  );
  fireEvent.click(screen.getByTestId("access-leaver-dismiss-62"));
  expect(onForget).toHaveBeenCalledWith(expect.objectContaining({ id: "62" }));
});

it("says why GitHub did not answer, and that a new team waits for a member", () => {
  setup({
    view: {
      ...teamView,
      teams: [
        { ...teamView.teams[0], unavailable_at: "2026-11-02T06:00:00Z" },
        { ...teamView.teams[0], slug: "ops", pinned: false },
      ],
    },
  });
  const habitat = screen.getByTestId("access-team-700-habitat");
  expect(habitat.textContent).toContain("2 jäsentä");
  expect(habitat.textContent).toContain("OAuth-sovelluksen");
  expect(screen.getByTestId("access-team-700-ops").textContent).toContain(
    "Kukaan tiimin jäsen ei ole vielä kirjautunut",
  );
});

it("adds a team typed in the field after a check, on its own", async () => {
  const onAddTeam = vi.fn(async () => ({ kind: "changed" as const }));
  setup({ view: teamView, onAddTeam });
  const input = screen.getByTestId("access-login-input");
  fireEvent.change(input, { target: { value: "frank Contoso-Power/ops" } });
  fireEvent.click(screen.getByTestId("access-add"));
  expect((await screen.findByTestId("access-check")).textContent).toContain(
    "Lisää tiimi yksinään",
  );
  fireEvent.change(input, { target: { value: "Contoso-Power/Habitat" } });
  fireEvent.click(screen.getByTestId("access-add"));
  expect((await screen.findByTestId("access-check")).textContent).toContain(
    "Tiimi on jo pääsyn lähde",
  );
  fireEvent.change(input, {
    target: { value: "https://github.com/orgs/Contoso-Power/teams/Ops" },
  });
  fireEvent.click(screen.getByTestId("access-add"));
  expect(
    (await screen.findByTestId("access-team-found")).textContent,
  ).toContain("Contoso-Power/ops");
  expect(screen.getByTestId("access-add").textContent).toBe("Lisää tiimi");
  fireEvent.click(screen.getByTestId("access-add"));
  await vi.waitFor(() =>
    expect(onAddTeam).toHaveBeenCalledWith("Contoso-Power/ops"),
  );
  await vi.waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(""));
});

it("detaches a team after confirming what ends", () => {
  const onRemoveTeam = vi.fn();
  setup({ view: teamView, onRemoveTeam });
  fireEvent.click(screen.getByTestId("access-detach-700-habitat"));
  const dialog = screen.getByTestId("access-detach-dialog");
  expect(dialog.textContent).toContain("seuraavalla kirjautumisellaan");
  fireEvent.click(screen.getByTestId("access-detach-confirm"));
  expect(onRemoveTeam).toHaveBeenCalledWith(teamView.teams[0]);
});
