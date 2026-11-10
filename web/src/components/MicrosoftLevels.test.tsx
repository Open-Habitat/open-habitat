import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Provider, ProviderId } from "../app/integrations";
import type {
  AppChange,
  AppSection,
  IntegrationApp,
  IntegrationApps,
} from "../app/serverIntegrations";
import { ServerIntegrations } from "./ServerIntegrations";

// Microsoft 365's four levels on Palvelinintegraatiot: one row, the
// comparison table behind Mitä tasot sallivat, and one guided setup that
// skips the levels root's file already has.

const tenant = "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903";
const fullID = "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3";
const readID = "11111111-2222-4333-8444-555555555555";
const nosendID = "22222222-3333-4444-8555-666666666666";
const draftsID = "33333333-4444-4555-8666-777777777777";

const provider = (id: ProviderId, available: boolean): Provider => ({
  id,
  available,
  login: "device_code",
  services: ["mail"],
  ...(available ? {} : { unavailable_reason: "app_credentials_required" }),
});
const section = (
  provider: AppSection,
  client_id: string,
  extra: Partial<IntegrationApp> = {},
): IntegrationApp => ({
  provider,
  client_id,
  tenant_id: tenant,
  usable: true,
  source: "site_admin",
  actor: "42",
  at: "2026-11-07T14:12:00Z",
  ...extra,
});
// Jari's situation: the full level set by clicking, the read level written
// by root, two levels missing.
const two: IntegrationApps = {
  schema_version: 1,
  browser_setup: true,
  apps: [
    section("microsoft", fullID),
    section("microsoft_read", readID, {
      source: "operator",
      actor: undefined,
      at: undefined,
    }),
  ],
};
const none: IntegrationApps = { ...two, apps: [] };

function setup(
  apps: IntegrationApps,
  reply: (s: AppSection) => AppChange = (s) => ({
    kind: "changed",
    view: { ...apps, apps: [...apps.apps, section(s, nosendID)] },
  }),
  props: Partial<Parameters<typeof ServerIntegrations>[0]> = {},
) {
  const calls = {
    onSave: vi.fn(async (s: AppSection) => reply(s)),
    onRemove: vi.fn(),
    onRefresh: vi.fn(),
  };
  const view = render(
    <ServerIntegrations
      providers={[
        provider("google", true),
        provider("microsoft", apps.apps.length > 0),
        provider("dropbox", true),
      ]}
      apps={apps}
      names={{ "42": "kaisa-admin" }}
      onboardingHref="/settings/onboarding"
      {...calls}
      {...props}
    />,
  );
  return { calls, view };
}
const dialog = () => screen.getByTestId("ml-dialog");
const d = () => within(dialog());
const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
const cell = (table: HTMLElement, row: string, level: string) => {
  const r = within(table)
    .getAllByRole("row")
    .find((x) => x.querySelector("th")?.textContent?.startsWith(row));
  const cols = [...table.querySelectorAll("thead th")];
  const i = cols.findIndex(
    (c) => (c as HTMLElement).dataset.testid === `ml-col-${level}`,
  );
  return r?.children[i]?.getAttribute("data-on");
};

it("keeps Microsoft's four levels in one row, the table behind Mitä tasot sallivat", () => {
  setup(two);
  // No row of its own for a level: they are all in Microsoft's.
  expect(
    screen
      .getAllByTestId(/^si-row-/)
      .map((r) => r.dataset.testid)
      .filter((t) => t?.startsWith("si-row-microsoft")),
  ).toEqual(["si-row-microsoft"]);
  const row = screen.getByTestId("si-row-microsoft");
  expect(within(row).getByTestId("si-levels-note").textContent).toBe(
    "2/4 tasoa asetettu: Täysi · Vain luku",
  );
  expect(within(row).getByTestId("si-status-microsoft").textContent).toContain(
    "2/4 tasoa tarjolla",
  );
  expect(within(row).getByTestId("si-setup-microsoft").textContent).toBe(
    "Aseta puuttuvat…",
  );
  // The table is closed until asked for, also before anything is set.
  expect(screen.queryByTestId("si-table-microsoft")).toBeNull();
  fireEvent.click(screen.getByTestId("si-levels-microsoft"));
  const table = screen.getByTestId("si-table-microsoft");
  expect(
    [...table.querySelectorAll("thead th")].slice(1).map((c) => c.textContent),
  ).toEqual([
    "TäysiTarjolla",
    "Kaikki paitsi postin lähetysEi tunnuksia",
    "Luonnokset, muu vain lukuEi tunnuksia",
    "Vain lukuTarjolla",
  ]);
  // Everything but sending: drafts, no sending, calendars and files changed.
  expect(cell(table, "Lähettää", "nosend")).toBe("no");
  expect(cell(table, "Lähettää", "full")).toBe("yes");
  expect(cell(table, "Järjestelee", "nosend")).toBe("yes");
  expect(cell(table, "Muokkaa tapahtumia", "nosend")).toBe("yes");
  expect(cell(table, "Muokkaa tapahtumia", "drafts")).toBe("no");
  expect(cell(table, "Muokkaa ja voi jakaa", "nosend")).toBe("yes");
  // The other providers' levels open the same way.
  fireEvent.click(screen.getByTestId("si-levels-dropbox"));
  expect(
    screen.getByTestId("si-table-dropbox").querySelectorAll("thead th"),
  ).toHaveLength(4);
});

it("starts from the table, the set levels skipped and the missing ones ticked", () => {
  setup(two);
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  expect(dialog().dataset.page).toBe("start");
  expect(d().getByTestId("ml-set-full")).toBeTruthy();
  expect(d().getByTestId("ml-set-read")).toBeTruthy();
  expect(d().queryByTestId("ml-pick-full")).toBeNull();
  // Where the guide knows them from: who and when, or root.
  expect(d().getByTestId("ml-known-full").textContent).toContain(
    "@kaisa-admin",
  );
  expect(d().getByTestId("ml-known-read").textContent).toContain(
    "asetettu palvelimella",
  );
  expect(d().getByTestId("ml-begin").textContent).toBe("Aloita: 2 tasoa");
  fireEvent.click(
    within(d().getByTestId("ml-pick-drafts")).getByRole("checkbox"),
  );
  expect(d().getByTestId("ml-begin").textContent).toBe("Aloita: 1 taso");
  fireEvent.click(
    within(d().getByTestId("ml-pick-nosend")).getByRole("checkbox"),
  );
  expect(d().getByTestId("ml-begin").textContent).toBe("Valitse taso");
  expect((d().getByTestId("ml-begin") as HTMLButtonElement).disabled).toBe(
    true,
  );
});

it("walks the chosen levels in full, reusing the saved tenant and refusing another level's id", async () => {
  const { calls } = setup(two);
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  fireEvent.click(d().getByTestId("ml-begin"));
  expect(dialog().dataset.page).toBe("walk");
  expect(
    within(d().getByTestId("ml-rail"))
      .getAllByRole("listitem")
      .map((l) => l.dataset.testid),
  ).toEqual(["ml-rail-nosend", "ml-rail-drafts"]);
  expect(d().getByTestId("ml-skipped").textContent).toBe(
    "Ei tässä asetuksessa: Täysi, Vain luku",
  );
  // The first application carries the one-time link to App registrations.
  expect(d().getByTestId("ml-console-link").getAttribute("href")).toMatch(
    /^https:\/\/entra\.microsoft\.com\//,
  );
  expect(d().getByTestId("ml-stepname").dataset.level).toBe("nosend");
  // Seventeen sub-items, one forward button.
  let presses = 0;
  while (!d().queryByTestId("ml-save")) {
    fireEvent.click(d().getByTestId("ml-next"));
    presses++;
  }
  expect(presses).toBe(16);
  expect(d().getByTestId("ml-tenant-known").textContent).toBe(tenant);
  expect(d().queryByTestId("ml-field-tenant")).toBeNull();

  // The client id of a level already set is refused in its field.
  fireEvent.click(d().getByTestId("ml-back"));
  type("ml-field-client-nosend", fullID);
  fireEvent.click(d().getByTestId("ml-next"));
  fireEvent.click(d().getByTestId("ml-save"));
  await waitFor(() =>
    expect(
      screen.getByTestId("ml-field-client-nosend").getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(calls.onSave).not.toHaveBeenCalled();
  type("ml-field-client-nosend", ` ${nosendID} `);
  fireEvent.click(d().getByTestId("ml-next"));
  fireEvent.click(d().getByTestId("ml-save"));
  await waitFor(() =>
    expect(calls.onSave).toHaveBeenCalledWith("microsoft_nosend", {
      client_id: nosendID,
      tenant_id: tenant,
    }),
  );
  // Saved: on to the next chosen level, from its first sub-item.
  await waitFor(() =>
    expect(d().getByTestId("ml-stepname").dataset.level).toBe("drafts"),
  );
  expect(d().getByTestId("ml-stepname").dataset.step).toBe("register");
  expect(d().getByTestId("ml-rail-nosend").dataset.done).toBe("true");
});

it("shows the permissions of each level, the no-send one without Mail.Send", () => {
  setup(two);
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  fireEvent.click(d().getByTestId("ml-begin"));
  for (let i = 0; i < 40 && !d().queryByTestId("ml-perms"); i++)
    fireEvent.click(d().getByTestId("ml-next"));
  const names = within(d().getByTestId("ml-perms"))
    .getAllByRole("listitem")
    .map((l) => l.textContent);
  expect(names).toContain("Calendars.ReadWrite");
  expect(names).toContain("Mail.ReadWrite");
  expect(names).not.toContain("Mail.Send");
  expect(names).not.toContain("User.Read");
  // Every level finds the person's Teams files.
  expect(names).toContain("Team.ReadBasic.All");
  expect(names).toContain("Channel.ReadBasic.All");
});

it("asks the tenant in the first application when nothing is set, and keeps a refusal's input", async () => {
  const { calls } = setup(none, () => ({ kind: "refused", code: "host_busy" }));
  expect(screen.getByTestId("si-setup-microsoft").textContent).toBe(
    "Luo sovellukset…",
  );
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  expect(d().getByTestId("ml-begin").textContent).toBe("Aloita: 4 tasoa");
  fireEvent.click(d().getByTestId("ml-begin"));
  // An existing application goes straight to its ids.
  fireEvent.click(d().getByTestId("ml-have-app"));
  expect(d().getByTestId("ml-panel").dataset.part).toBe("consent.full.client");
  type("ml-field-client-full", fullID);
  fireEvent.click(d().getByTestId("ml-next"));
  type("ml-field-tenant", "common");
  fireEvent.click(d().getByTestId("ml-save"));
  await waitFor(() =>
    expect(
      screen.getByTestId("ml-field-tenant").getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(calls.onSave).not.toHaveBeenCalled();
  type("ml-field-tenant", tenant);
  expect(d().getByTestId("ml-consent-link").textContent).toContain(
    `https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${fullID}`,
  );
  fireEvent.click(d().getByTestId("ml-save"));
  await waitFor(() => expect(d().getByTestId("ml-refusal")).toBeTruthy());
  expect(calls.onSave).toHaveBeenCalledWith("microsoft", {
    client_id: fullID,
    tenant_id: tenant,
  });
  expect(
    (screen.getByTestId("ml-field-tenant") as HTMLInputElement).value,
  ).toBe(tenant);
});

it("removes one level's credentials from the start page as a level, not the provider", () => {
  const { calls } = setup(two);
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  fireEvent.click(d().getByTestId("ml-remove-read"));
  const confirm = screen.getByTestId("si-remove-dialog");
  expect(within(confirm).queryByTestId("si-remove-other")).toBeNull();
  fireEvent.click(within(confirm).getByTestId("si-remove-confirm"));
  expect(calls.onRemove).toHaveBeenCalledWith("microsoft_read");
});

it("says why root's ignored section is not set and offers it again", () => {
  setup({
    ...two,
    apps: [
      ...two.apps,
      section("microsoft_drafts", draftsID, {
        tenant_id: "common",
        usable: false,
        source: "operator",
      }),
    ],
  });
  expect(screen.getByTestId("si-invalid-microsoft_drafts")).toBeTruthy();
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  expect(d().getByTestId("ml-known-drafts").dataset.usable).toBeUndefined();
  expect(d().getByTestId("ml-pick-drafts")).toBeTruthy();
});

it("shows a level's change in flight on the row, and an uncertain one with a refresh", () => {
  const { calls, view } = setup(two, undefined, {
    pending: { microsoft_nosend: "set" },
  });
  expect(screen.getByTestId("si-row-microsoft").dataset.status).toBe("set");
  view.rerender(
    <ServerIntegrations
      providers={[provider("microsoft", true)]}
      apps={two}
      pending={{ microsoft_nosend: "uncertain" }}
      onboardingHref="/settings/onboarding"
      {...calls}
    />,
  );
  fireEvent.click(screen.getByTestId("si-refresh-microsoft"));
  expect(calls.onRefresh).toHaveBeenCalledOnce();
});

it("reads every level done and offers the levels behind one quiet button", () => {
  setup({
    ...two,
    apps: [
      ...two.apps,
      section("microsoft_nosend", nosendID),
      section("microsoft_drafts", draftsID),
    ],
  });
  expect(screen.getByTestId("si-setup-microsoft").textContent).toBe("Tasot");
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  expect(d().getByTestId("ml-finish")).toBeTruthy();
  expect(d().queryByTestId("ml-begin")).toBeNull();
});

it("says Dropbox's App folder level shares too, inside its own folder", () => {
  setup(two);
  fireEvent.click(screen.getByTestId("si-levels-dropbox"));
  const table = screen.getByTestId("si-table-dropbox");
  // The App folder application asks sharing.write like the full one.
  expect(cell(table, "Jakaa", "app_folder")).toBe("part");
  expect(cell(table, "Jakaa", "read")).toBe("no");
  expect(cell(table, "Jakaa", "full")).toBe("yes");
});

it("keeps an unsaved application's id when the walk goes back to the start", () => {
  setup(two);
  fireEvent.click(screen.getByTestId("si-setup-microsoft"));
  fireEvent.click(d().getByTestId("ml-begin"));
  fireEvent.click(d().getByTestId("ml-have-app"));
  type("ml-field-client-nosend", nosendID);
  // Back to the first sub-item, then out to the table.
  fireEvent.click(d().getByTestId("ml-rail-nosend"));
  while (dialog().dataset.page === "walk")
    fireEvent.click(d().getByTestId("ml-back"));
  fireEvent.click(d().getByTestId("ml-begin"));
  fireEvent.click(d().getByTestId("ml-have-app"));
  expect(
    (screen.getByTestId("ml-field-client-nosend") as HTMLInputElement).value,
  ).toBe(nosendID);
});
