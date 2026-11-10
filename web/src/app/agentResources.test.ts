import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildResources,
  type FileRoot,
  readFileRoots,
  readFolder,
} from "./agentResources";
import { type IntegrationList, Refused } from "./integrations";
import type { OwnMachines } from "./ownMachines";

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ms = "aino@company.example";
const gmail = "aino@gmail.example";
const checked = "2026-11-06T08:50:00Z";

const list = (over: Partial<IntegrationList> = {}): IntegrationList => ({
  schema_version: 1,
  providers: [
    {
      id: "google",
      available: true,
      login: "pasted_redirect",
      services: ["drive", "mail", "calendar", "contacts"],
    },
    {
      id: "microsoft",
      available: true,
      login: "device_code",
      services: ["onedrive", "sharepoint", "mail", "calendar", "contacts"],
    },
    {
      id: "dropbox",
      available: true,
      login: "pasted_redirect",
      services: ["dropbox"],
    },
    {
      id: "apple",
      available: true,
      login: "app_password",
      services: ["mail", "calendar", "contacts"],
    },
    { id: "imap", available: false, login: "app_password", services: ["mail"] },
  ],
  accounts: [
    {
      provider: "microsoft",
      address: ms,
      level: "full",
      checked_at: checked,
      services: [
        {
          id: "onedrive",
          state: "ok",
          access: "full",
          directory: `~/cloud/onedrive/${ms}`,
          last_synced_at: checked,
        },
        { id: "sharepoint", state: "ok", access: "full" },
        { id: "mail", state: "ok", access: "full" },
        { id: "calendar", state: "ok", access: "full" },
      ],
    },
    {
      provider: "google",
      address: gmail,
      level: "read",
      checked_at: checked,
      services: [
        {
          id: "drive",
          state: "sync_failed",
          failure: "not_chosen",
          access: "read",
        },
        { id: "mail", state: "unknown", access: "none" },
      ],
    },
  ],
  skill: "current",
  ...over,
});

const roots: FileRoot[] = [
  {
    provider: "microsoft",
    address: ms,
    service: "onedrive",
    directory: `~/cloud/onedrive/${ms}`,
  },
  {
    provider: "microsoft",
    address: ms,
    service: "sharepoint",
    directory: `~/cloud/sharepoint/company--${ms}/a/b`,
  },
  {
    provider: "microsoft",
    address: ms,
    service: "sharepoint",
    directory: `~/cloud/sharepoint/company--${ms}/a/c`,
  },
];

describe("agent resources", () => {
  it("lists every account's sources by kind with their limits and settings", () => {
    const r = buildResources(list(), roots, undefined, {
      state: "connected",
      login: "aino-virtanen",
    });
    expect(r.sources.map((s) => `${s.kind}:${s.name}`)).toEqual([
      "files:OneDrive",
      "files:SharePoint 1",
      "files:SharePoint 2",
      "files:Google Drive",
      "mail:Outlook-posti",
      "mail:Gmail",
      "calendar:Outlook-kalenteri",
      "code:GitHub",
    ]);
    const onedrive = r.sources[0];
    expect(onedrive.directory).toBe(`~/cloud/onedrive/${ms}`);
    expect(onedrive.settings.href).toBe("/settings/agent-data#microsoft");
    expect(onedrive.pill).toEqual({ text: "Täysi", full: true });
    expect(
      onedrive.verbs.find((v) => v.label === "Jakaa linkillä"),
    ).toMatchObject({ yes: true, cannotBlock: true });
    expect(r.sources[1].hidden.map((h) => h.id)).toEqual(["libraries"]);
    const mail = r.sources[4];
    expect(mail.verbs.map((v) => v.yes)).toEqual([true, true, true, true]);
    expect(mail.web?.href).toBe("https://outlook.office.com/mail/");
  });

  it("says what a narrower grant and a missing choice leave out", () => {
    const r = buildResources(list(), roots, undefined, undefined);
    const drive = r.sources.find((s) => s.name === "Google Drive");
    expect(drive?.can).toBe("read");
    expect(drive?.directory).toBeUndefined();
    expect(drive?.unavailable).toBe("Kansioita ei ole valittu.");
    expect(drive?.hidden.map((h) => h.id)).toEqual(["drive", "google-docs"]);
    expect(drive?.verbs.filter((v) => v.yes).map((v) => v.label)).toEqual([
      "Lukea",
    ]);
    const gmailSource = r.sources.find((s) => s.name === "Gmail");
    expect(gmailSource?.can).toBe("none");
    expect(gmailSource?.scope).toEqual([]);
    expect(gmailSource?.hidden[0]?.action?.href).toBe(
      "/settings/agent-data#google",
    );
    expect(gmailSource?.web?.href).toBe(
      `https://mail.google.com/mail/?authuser=${encodeURIComponent(gmail)}`,
    );
  });

  it("keeps the file sources when their folders could not be read", () => {
    const r = buildResources(list(), undefined, undefined, undefined);
    const files = r.sources.filter((s) => s.kind === "files");
    expect(files.map((s) => s.name)).toEqual([
      "OneDrive",
      "SharePoint",
      "Google Drive",
    ]);
    for (const s of files) {
      expect(s.directory).toBeUndefined();
      expect(s.unavailable).toBe("Kansiota ei voitu lukea.");
    }
  });

  it("offers what is not connected, and GitHub when gh is not", () => {
    const r = buildResources(list(), [], undefined, { state: "disconnected" });
    expect(r.offers.map((o) => o.id)).toEqual([
      "dropbox",
      "apple",
      "github",
      "machine",
    ]);
    expect(r.offers.find((o) => o.id === "apple")?.kinds).toEqual([
      "mail",
      "calendar",
      "contacts",
    ]);
    expect(r.sources.some((s) => s.kind === "code")).toBe(false);
  });

  it("names an app folder's limit and a machine's end", () => {
    const machines = {
      machines: [
        {
          name: "aino-mbp",
          user: "aino",
          address: "100.64.0.2",
          expires: "2026-12-04",
          expired: false,
          in_tailnet: true,
          online: true,
          os: "macOS",
          host_key: "SHA256:x",
          connection_open: false,
        },
        {
          name: "vanha",
          user: "aino",
          address: "100.64.0.3",
          expires: "2026-10-01",
          expired: true,
          in_tailnet: true,
          online: false,
          host_key: "SHA256:y",
          connection_open: false,
        },
      ],
    } as unknown as OwnMachines;
    const r = buildResources(
      list({
        accounts: [
          {
            provider: "dropbox",
            address: ms,
            level: "app_folder",
            checked_at: checked,
            services: [{ id: "dropbox", state: "ok", access: "full" }],
          },
        ],
      }),
      [
        {
          provider: "dropbox",
          address: ms,
          service: "dropbox",
          directory: `~/cloud/dropbox-app-folder/${ms}`,
        },
      ],
      machines,
      undefined,
    );
    const dropbox = r.sources[0];
    expect(dropbox.hidden.map((h) => h.id)).toEqual(["dropbox"]);
    expect(dropbox.verbs[0]).toMatchObject({
      yes: true,
      note: "vain sovelluksen oma kansio",
    });
    const [mbp, old] = r.sources.filter((s) => s.kind === "machines");
    expect(mbp.can).toBe("change");
    expect(mbp.hidden.map((h) => h.id)).toEqual(["mac"]);
    expect(mbp.verbs.find((v) => v.cannotBlock)?.label).toBe(
      "Palvelimen ylläpitäjä pääsee samaa reittiä",
    );
    expect(old.can).toBe("none");
    expect(old.pill?.full).toBe(false);
    expect(r.connections).toBe(3);
  });
});

describe("synced folder reads", () => {
  it("validates the roots and a folder against the contract", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    fetch.mockResolvedValueOnce(json({ schema_version: 1, roots }));
    expect(await readFileRoots()).toEqual(roots);
    fetch.mockResolvedValueOnce(
      json({
        schema_version: 1,
        directory: roots[0].directory,
        folder: "Raportit",
        entries: [
          { name: "a.md", kind: "file", bytes: 3, modified_at: checked },
        ],
        truncated: false,
      }),
    );
    const folder = await readFolder(roots[0].directory, "Raportit");
    expect(folder.entries[0].name).toBe("a.md");
    expect(String(fetch.mock.calls[1][0])).toBe(
      `/api/v1/integrations/files?${new URLSearchParams({ directory: roots[0].directory, folder: "Raportit" })}`,
    );
  });

  it("refuses a reply for another folder or with a path in a name", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    fetch.mockResolvedValueOnce(
      json({
        schema_version: 1,
        directory: roots[0].directory,
        entries: [],
        truncated: false,
      }),
    );
    await expect(readFolder(roots[0].directory, "Raportit")).rejects.toThrow(
      "invalid",
    );
    fetch.mockResolvedValueOnce(
      json({
        schema_version: 1,
        directory: roots[0].directory,
        entries: [{ name: "../x", kind: "file", modified_at: checked }],
        truncated: false,
      }),
    );
    await expect(readFolder(roots[0].directory, "")).rejects.toThrow("invalid");
    fetch.mockResolvedValueOnce(
      json({ schema_version: 1, error: { code: "folder_missing" } }, 404),
    );
    await expect(readFolder(roots[0].directory, "x")).rejects.toBeInstanceOf(
      Refused,
    );
  });
});
