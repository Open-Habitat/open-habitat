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
import type { AppChange, IntegrationApps } from "../app/serverIntegrations";
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
      steps={["google", "microsoft"]}
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

it("orders the catalog's six rows and offers each state's one action", () => {
  setup();
  expect(
    screen
      .getAllByTestId(/^si-row-/)
      .map((r) => [r.dataset.testid, r.dataset.status]),
  ).toEqual([
    ["si-row-google", "ready"],
    ["si-row-microsoft", "needs_app"],
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
  // A ready DAV row has nothing to do.
  expect(within(row("imap")).queryByRole("button")).toBeNull();
});

it("marks only providers with an onboarding step, hidden while not ready", () => {
  const calls = setup();
  expect(screen.getByTestId("si-step-google").dataset.hidden).toBeUndefined();
  expect(screen.getByTestId("si-step-microsoft").dataset.hidden).toBe("true");
  expect(screen.queryByTestId("si-step-imap")).toBeNull();
  fireEvent.click(screen.getByTestId("si-step-microsoft"));
  expect(calls.onOpenOnboarding).toHaveBeenCalledOnce();
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

it("keeps a refused setup open with what was typed", async () => {
  const calls = setup({}, { kind: "refused", code: "host_busy" });
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  type("si-field-client_id", "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3");
  type("si-field-tenant_id", "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3");
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  // The same value twice is caught before anything is sent.
  await waitFor(() => expect(calls.onSave).not.toHaveBeenCalled());
  type("si-field-tenant_id", "organizations");
  fireEvent.click(within(dialog()).getByTestId("si-save"));
  await waitFor(() =>
    expect(within(dialog()).getByTestId("si-refusal")).toBeTruthy(),
  );
  expect(
    (screen.getByTestId("si-field-client_id") as HTMLInputElement).value,
  ).toBe("5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3");
  expect(calls.onSave).toHaveBeenCalledOnce();
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
