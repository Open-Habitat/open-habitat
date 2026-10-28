import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Provider, ProviderId } from "../app/integrations";
import {
  type AppChange,
  type IntegrationApps,
  invalidApp,
} from "../app/serverIntegrations";
import { fixCommand, ServerIntegrations } from "./ServerIntegrations";

const googleID =
  "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com";
const provider = (
  id: ProviderId,
  available: boolean,
  extra: Partial<Provider> = {},
): Provider => ({
  id,
  available,
  login: "app_password",
  services: ["mail"],
  ...extra,
});
// Google in use, Microsoft waiting for its app, Dropbox missing rclone.
const providers: Provider[] = [
  provider("google", true),
  provider("microsoft", false, {
    unavailable_reason: "app_credentials_required",
  }),
  provider("apple", true),
  provider("imap", true),
  provider("caldav", true),
  provider("carddav", true),
  provider("dropbox", false, {
    unavailable_reason: "tool_unavailable",
    missing_tools: ["rclone"],
  }),
];
const apps: IntegrationApps = {
  schema_version: 1,
  browser_setup: true,
  apps: [
    {
      provider: "google",
      client_id: googleID,
      usable: true,
      source: "site_admin",
      actor: "42",
      at: "2026-10-24T12:00:00Z",
    },
  ],
};

function setup(
  props: Partial<Parameters<typeof ServerIntegrations>[0]> = {},
  reply: AppChange = { kind: "changed", view: apps },
) {
  const calls = {
    onSave: vi.fn(async () => reply),
    onRemove: vi.fn(),
    onRefresh: vi.fn(),
    onOpenOnboarding: vi.fn(),
  };
  render(
    <ServerIntegrations
      providers={providers}
      apps={apps}
      steps={["google", "microsoft", "apple"]}
      onboardingHref="/settings/onboarding"
      {...calls}
      {...props}
    />,
  );
  return calls;
}
const row = (p: ProviderId) => screen.getByTestId(`si-row-${p}`);
const dialog = () => screen.getByTestId("si-setup-dialog");
const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

it("orders the catalog's seven rows and offers each state's one action", () => {
  setup();
  expect(
    screen
      .getAllByTestId(/^si-row-/)
      .map((r) => [r.dataset.testid, r.dataset.status]),
  ).toEqual([
    ["si-row-google", "ready"],
    ["si-row-microsoft", "needs_app"],
    // A provider's narrower levels follow it; a provider whose tools are
    // missing has none to set.
    ["si-row-microsoft_drafts", "needs_app"],
    ["si-row-microsoft_read", "needs_app"],
    ["si-row-apple", "ready"],
    ["si-row-imap", "ready"],
    ["si-row-caldav", "ready"],
    ["si-row-carddav", "ready"],
    ["si-row-dropbox", "tool_missing"],
  ]);
  expect(within(row("google")).getByTestId("si-menu-google")).toBeTruthy();
  expect(
    within(row("microsoft")).getByTestId("si-setup-microsoft"),
  ).toBeTruthy();
  expect(within(row("dropbox")).getByTestId("si-fix-dropbox")).toBeTruthy();
  expect(within(row("apple")).queryByRole("button")).toBeNull();
  expect(screen.getByTestId("si-connect-note")).toBeTruthy();
  // A ready DAV row has nothing to do.
  expect(within(row("imap")).queryByRole("button")).toBeNull();
});

it("marks only providers with an onboarding step, hidden while not ready", () => {
  const calls = setup();
  expect(screen.getByTestId("si-step-google").dataset.hidden).toBeUndefined();
  expect(screen.getByTestId("si-step-microsoft").dataset.hidden).toBe("true");
  expect(screen.getByTestId("si-step-apple").dataset.hidden).toBeUndefined();
  expect(screen.queryByTestId("si-step-imap")).toBeNull();
  fireEvent.click(screen.getByTestId("si-step-microsoft"));
  expect(calls.onOpenOnboarding).toHaveBeenCalledOnce();
});

it("takes Apple's missing-tool status from the catalog and hides its onboarding step", () => {
  setup({
    providers: providers.map((p) =>
      p.id === "apple"
        ? provider("apple", false, {
            unavailable_reason: "tool_unavailable",
            missing_tools: ["himalaya"],
          })
        : p,
    ),
  });
  expect(row("apple").dataset.status).toBe("tool_missing");
  expect(screen.getByTestId("si-step-apple").dataset.hidden).toBe("true");
  expect(screen.queryByTestId("si-setup-apple")).toBeNull();
  expect(screen.queryByTestId("si-menu-apple")).toBeNull();
  fireEvent.click(screen.getByTestId("si-fix-apple"));
  expect(screen.getByTestId("si-fix-dialog")).toBeTruthy();
});

it("walks Google's steps, or skips to the fields, and sends nothing invalid", async () => {
  const calls = setup({
    apps: { ...apps, apps: [] },
    providers: providers.map((p) =>
      p.id === "google"
        ? provider("google", false, {
            unavailable_reason: "app_credentials_required",
          })
        : p,
    ),
  });
  fireEvent.click(screen.getByTestId("si-setup-google"));
  const steps: string[] = [];
  for (;;) {
    steps.push(within(dialog()).getByTestId("si-stepname").dataset.step ?? "");
    const next = within(dialog()).queryByTestId("si-next");
    if (!next) break;
    fireEvent.click(next);
  }
  expect(steps).toEqual(["apis", "audience", "scopes", "client", "enter"]);
  // Internal only: there is no audience choice to make.
  fireEvent.click(within(dialog()).getByTestId("si-back"));
  fireEvent.click(within(dialog()).getByTestId("si-back"));
  // Each scope as Data Access › Add or Remove Scopes lists it.
  expect(
    within(dialog()).getByTestId("si-scopes").querySelector("pre")?.textContent,
  ).toBe(
    [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/contacts",
    ].join("\n"),
  );
  fireEvent.click(within(dialog()).getByTestId("si-back"));
  expect(within(dialog()).queryByRole("radio")).toBeNull();
  expect(within(dialog()).queryByTestId("segment-external")).toBeNull();
  fireEvent.click(within(dialog()).getByTestId("si-back"));
  fireEvent.click(within(dialog()).getByTestId("si-skip"));
  type("si-field-client_id", "abc");
  type("si-field-client_secret", "GOCSPX-x");
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() =>
    expect(
      screen.getByTestId("si-field-client_id").getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(calls.onSave).not.toHaveBeenCalled();
  type("si-field-client_id", ` ${googleID} `);
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() =>
    expect(screen.queryByTestId("si-setup-dialog")).toBeNull(),
  );
  expect(calls.onSave).toHaveBeenCalledWith("google", {
    client_id: googleID,
    client_secret: "GOCSPX-x",
  });
});

const clientID = "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3";
const tenantID = "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903";
const invalid = (testId: string) =>
  screen.getByTestId(testId).getAttribute("aria-invalid") === "true";

it("walks Microsoft's single-tenant guide with the ids last and no secret", async () => {
  const calls = setup({}, { kind: "refused", code: "host_busy" });
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  const steps: string[] = [];
  for (;;) {
    steps.push(within(dialog()).getByTestId("si-stepname").dataset.step ?? "");
    const next = within(dialog()).queryByTestId("si-next");
    if (!next) break;
    fireEvent.click(next);
  }
  expect(steps).toEqual([
    "register",
    "public",
    "permissions",
    "consent",
    "enter",
  ]);
  expect(within(dialog()).queryByTestId("si-field-client_secret")).toBeNull();
  expect(within(dialog()).queryByRole("radio")).toBeNull();

  // An audience keyword or a domain is not the organisation's tenant id,
  // and the client id pasted twice is caught, before anything is sent.
  type("si-field-client_id", clientID);
  for (const tenant of ["common", "organizations", "contoso.onmicrosoft.com"]) {
    type("si-field-tenant_id", tenant);
    fireEvent.click(within(dialog()).getByTestId("si-save"));
    await waitFor(() => expect(invalid("si-field-tenant_id")).toBe(true));
  }
  type("si-field-tenant_id", clientID.toUpperCase());
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() => expect(invalid("si-field-tenant_id")).toBe(true));
  expect(invalid("si-field-client_id")).toBe(false);
  expect(calls.onSave).not.toHaveBeenCalled();
  // Correcting the field clears its error.
  type("si-field-tenant_id", ` ${tenantID} `);
  expect(invalid("si-field-tenant_id")).toBe(false);

  // A refusal keeps the dialog and what was typed.
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() =>
    expect(within(dialog()).getByTestId("si-refusal")).toBeTruthy(),
  );
  expect(calls.onSave).toHaveBeenCalledWith("microsoft", {
    client_id: clientID,
    tenant_id: tenantID,
  });
  expect(
    (screen.getByTestId("si-field-client_id") as HTMLInputElement).value,
  ).toBe(clientID);
});

it("names why root's existing section is ignored and replaces it through the guide", () => {
  setup({
    apps: {
      ...apps,
      apps: [
        ...apps.apps,
        // Written for the multi-tenant app before it became single tenant.
        {
          provider: "microsoft",
          client_id: clientID,
          tenant_id: "common",
          usable: false,
          source: "operator",
        },
      ],
    },
  });
  expect(
    within(row("microsoft")).getByTestId("si-invalid-microsoft"),
  ).toBeTruthy();
  expect(screen.queryByTestId("si-invalid-google")).toBeNull();
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  expect(within(dialog()).getByTestId("si-stepname").dataset.step).toBe(
    "register",
  );
});

it("tells an audience keyword from a malformed id in an ignored section", () => {
  const ms = (tenant_id?: string, client_id = clientID) => ({
    provider: "microsoft" as const,
    client_id,
    tenant_id,
    usable: false,
    source: "operator" as const,
  });
  expect(
    ["Common", "organizations", "consumers"].map((t) => invalidApp(ms(t))),
  ).toEqual(["audience", "audience", "audience"]);
  expect(invalidApp(ms(undefined))).toBe("tenant");
  expect(invalidApp(ms("contoso.onmicrosoft.com"))).toBe("tenant");
  expect(invalidApp(ms(tenantID, "not-a-guid"))).toBe("client");
  expect(invalidApp({ ...ms(tenantID), usable: true })).toBeUndefined();
  // A Google section whose secret the browser never sees.
  expect(
    invalidApp({
      provider: "google",
      client_id: googleID,
      usable: false,
      source: "operator",
    }),
  ).toBe("other");
});

it("skips Microsoft's guide straight to the ids for an existing app", () => {
  setup();
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  fireEvent.click(within(dialog()).getByTestId("si-skip"));
  expect(within(dialog()).getByTestId("si-stepname").dataset.step).toBe(
    "enter",
  );
  expect(within(dialog()).getByTestId("si-save")).toBeTruthy();
});

it("offers only removal for Microsoft's app, which has no secret to replace", async () => {
  const calls = setup({
    providers: providers.map((p) =>
      p.id === "microsoft" ? provider("microsoft", true) : p,
    ),
    apps: {
      ...apps,
      apps: [
        ...apps.apps,
        {
          provider: "microsoft",
          client_id: clientID,
          tenant_id: tenantID,
          usable: true,
          source: "site_admin",
          actor: "42",
          at: "2026-10-24T12:00:00Z",
        },
      ],
    },
  });
  fireEvent.click(
    within(screen.getByTestId("si-menu-microsoft")).getByRole("button"),
  );
  await screen.findByTestId("menu-remove");
  expect(screen.queryByTestId("menu-replace")).toBeNull();
  fireEvent.click(screen.getByTestId("menu-remove"));
  const confirm = screen.getByTestId("si-remove-dialog");
  expect(within(confirm).getByTestId("si-remove-other")).toBeTruthy();
  fireEvent.click(within(confirm).getByTestId("si-remove-confirm"));
  expect(calls.onRemove).toHaveBeenCalledWith("microsoft");
});

const dropboxNeedsApp = providers.map((p) =>
  p.id === "dropbox"
    ? provider("dropbox", false, {
        unavailable_reason: "app_credentials_required",
      })
    : p,
);

it("walks Dropbox's App Console pages with the keys last and sends nothing the broker would refuse", async () => {
  const calls = setup({ providers: dropboxNeedsApp });
  fireEvent.click(screen.getByTestId("si-setup-dropbox"));
  const steps: string[] = [];
  for (;;) {
    steps.push(within(dialog()).getByTestId("si-stepname").dataset.step ?? "");
    const next = within(dialog()).queryByTestId("si-next");
    if (!next) break;
    fireEvent.click(next);
  }
  expect(steps).toEqual(["create", "settings", "permissions", "enter"]);
  expect(
    within(dialog()).getByTestId("si-field-client_secret").getAttribute("type"),
  ).toBe("password");

  // A secret outside the broker's alphabet, or the App key pasted twice in
  // another case, stays in its field.
  type("si-field-client_id", "p3n8vq1zt6ka0rw");
  for (const secret of [
    "h2m5 c9xj4ub7ye1",
    "h2m5.c9xj4ub7ye1",
    "P3N8VQ1ZT6KA0RW",
  ]) {
    type("si-field-client_secret", secret);
    fireEvent.click(within(dialog()).getByTestId("si-save"));
    await waitFor(() => expect(invalid("si-field-client_secret")).toBe(true));
  }
  expect(calls.onSave).not.toHaveBeenCalled();
  type("si-field-client_secret", " h2m5c9xj4ub7ye1 ");
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() =>
    expect(calls.onSave).toHaveBeenCalledWith("dropbox", {
      client_id: "p3n8vq1zt6ka0rw",
      client_secret: "h2m5c9xj4ub7ye1",
    }),
  );
});

it("offers only removal for Dropbox's app and keeps the Development-status rule in its menu", async () => {
  const calls = setup({
    providers: providers.map((p) =>
      p.id === "dropbox" ? provider("dropbox", true) : p,
    ),
    apps: {
      ...apps,
      apps: [
        ...apps.apps,
        {
          provider: "dropbox",
          client_id: "p3n8vq1zt6ka0rw",
          usable: true,
          source: "site_admin",
          actor: "42",
          at: "2026-10-24T12:00:00Z",
        },
      ],
    },
  });
  fireEvent.click(
    within(screen.getByTestId("si-menu-dropbox")).getByRole("button"),
  );
  await screen.findByTestId("menu-remove");
  expect(screen.queryByTestId("menu-replace")).toBeNull();
  expect(screen.getByTestId("si-limit-note")).toBeTruthy();
  fireEvent.click(screen.getByTestId("menu-remove"));
  const confirm = screen.getByTestId("si-remove-dialog");
  expect(within(confirm).getByTestId("si-sync-stops")).toBeTruthy();
  fireEvent.click(within(confirm).getByTestId("si-remove-confirm"));
  expect(calls.onRemove).toHaveBeenCalledWith("dropbox");
});

it("replaces only Google's secret, for the same client", async () => {
  const calls = setup();
  fireEvent.click(
    within(screen.getByTestId("si-menu-google")).getByRole("button"),
  );
  fireEvent.click(await screen.findByTestId("menu-replace"));
  expect(within(dialog()).queryByTestId("si-field-client_id")).toBeNull();
  expect(within(dialog()).queryByTestId("si-next")).toBeNull();
  type("si-field-client_secret", "GOCSPX-new");
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() =>
    expect(calls.onSave).toHaveBeenCalledWith("google", {
      client_id: googleID,
      client_secret: "GOCSPX-new",
    }),
  );
});

it("confirms a removal with its consequences before asking the host", async () => {
  const calls = setup();
  fireEvent.click(
    within(screen.getByTestId("si-menu-google")).getByRole("button"),
  );
  fireEvent.click(await screen.findByTestId("menu-remove"));
  const confirm = screen.getByTestId("si-remove-dialog");
  // New connections, signing in again and the onboarding step.
  expect(within(confirm).getAllByRole("listitem")).toHaveLength(3);
  expect(calls.onRemove).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByTestId("si-remove-confirm"));
  expect(calls.onRemove).toHaveBeenCalledWith("google");
});

it("locks credential writes while root's switch is off", () => {
  setup({ apps: { ...apps, browser_setup: false } });
  expect(
    (screen.getByTestId("si-setup-microsoft") as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByTestId("si-setup-off")).toBeTruthy();
});

it("shows a change in flight as waiting and an uncertain one with a refresh", () => {
  const calls = setup({ pending: { google: "clear", microsoft: "uncertain" } });
  expect(row("google").dataset.status).toBe("clear");
  expect(within(row("google")).queryByRole("button")).toBeNull();
  fireEvent.click(screen.getByTestId("si-refresh-microsoft"));
  expect(calls.onRefresh).toHaveBeenCalledOnce();
});

it("copies the one command that installs a missing tool", async () => {
  const writeText = vi.fn(async () => {});
  Object.assign(navigator, { clipboard: { writeText } });
  setup();
  fireEvent.click(screen.getByTestId("si-fix-dropbox"));
  await act(async () => {
    fireEvent.click(
      within(screen.getByTestId("si-fix-dialog")).getByTestId("si-copy"),
    );
  });
  expect(writeText).toHaveBeenCalledWith(fixCommand);
});

it("sets and removes a level's own application as its own section", async () => {
  const withRead: IntegrationApps = {
    ...apps,
    apps: [
      ...apps.apps,
      {
        provider: "microsoft_read",
        client_id: "11111111-2222-4333-8444-555555555555",
        tenant_id: "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903",
        usable: true,
        source: "site_admin",
        actor: "root",
        at: "2026-10-28T06:00:00Z",
      },
    ],
  };
  const calls = setup({ apps: withRead });
  expect(row("microsoft_read" as ProviderId).dataset.status).toBe("ready");
  fireEvent.click(screen.getByTestId("si-setup-microsoft_drafts"));
  fireEvent.click(screen.getByTestId("si-skip"));
  type("si-field-client_id", "22222222-3333-4444-8555-666666666666");
  type("si-field-tenant_id", "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903");
  fireEvent.click(screen.getByTestId("si-save"));
  await waitFor(() =>
    expect(calls.onSave).toHaveBeenCalledWith("microsoft_drafts", {
      client_id: "22222222-3333-4444-8555-666666666666",
      tenant_id: "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903",
    }),
  );
});
