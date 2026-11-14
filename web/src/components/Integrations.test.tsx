import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  Account,
  IntegrationList,
  LoginView,
  Provider,
} from "../app/integrations";
import {
  ConnectDialog,
  IntegrationsOverview,
  RemoveDialog,
} from "./Integrations";

const imap: Provider = {
  id: "imap",
  available: true,
  login: "app_password",
  services: ["mail"],
};
const google: Provider = {
  id: "google",
  available: true,
  login: "pasted_redirect",
  services: ["mail", "calendar", "contacts", "drive"],
};
const list: IntegrationList = {
  schema_version: 1,
  providers: [google, imap],
  skill: "current",
  accounts: [
    {
      provider: "imap",
      address: "person@example.test",
      checked_at: "2026-10-19T06:38:00Z",
      services: [{ id: "mail", state: "credentials_rejected" }],
    },
  ],
};
const noop = () => {};

describe("Integraatiot overview", () => {
  it("shows a narrower grant: what is missing, who narrowed it and the grant in the provider's names", async () => {
    const onSignInAgain = vi.fn();
    const account = (provider: "microsoft" | "google") => ({
      provider,
      address: "person@example.test",
      checked_at: "2026-10-28T06:38:00Z",
      services:
        provider === "microsoft"
          ? [
              {
                id: "onedrive" as const,
                state: "unknown" as const,
                access: "none" as const,
              },
              {
                id: "mail" as const,
                state: "ok" as const,
                access: "drafts" as const,
              },
              {
                id: "calendar" as const,
                state: "ok" as const,
                access: "read" as const,
              },
            ]
          : [
              {
                id: "drive" as const,
                state: "unknown" as const,
                access: "none" as const,
              },
              {
                id: "mail" as const,
                state: "ok" as const,
                access: "full" as const,
              },
            ],
      grant:
        provider === "microsoft"
          ? {
              granted: ["Calendars.Read", "Mail.ReadWrite", "User.Read"],
              not_granted: ["Files.ReadWrite.All", "Mail.Send"],
            }
          : {
              granted: ["https://www.googleapis.com/auth/gmail.modify"],
              not_granted: ["https://www.googleapis.com/auth/drive"],
            },
    });
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          providers: [
            google,
            {
              id: "microsoft",
              available: true,
              login: "device_code",
              services: ["onedrive", "mail", "calendar"],
            },
          ],
          accounts: [account("microsoft"), account("google")],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={onSignInAgain}
        onRemove={noop}
      />,
    );
    expect(view.getByTestId("integration-limits").textContent).toContain(
      "Se ei estä tätä",
    );
    const ms = view.getByTestId("integration-account-microsoft");
    const notice =
      within(ms).getByTestId("integration-account-narrowed").textContent ?? "";
    expect(notice).toContain("Organisaatiosi on rajannut");
    expect(notice).toContain("Outlook-posti: lähetys");
    expect(notice).toContain("Outlook-kalenteri: muokkaus");
    expect(notice).toContain("OneDrive ja SharePoint");
    const onedrive = within(ms).getByTestId("integration-service-onedrive");
    expect(onedrive.dataset.access).toBe("none");
    expect(onedrive.textContent).toContain("Ei käytössä");
    expect(
      within(ms).getByTestId("integration-service-mail").textContent,
    ).toContain("Ei voi lähettää");
    // The organisation's limit is not changed by signing in again.
    expect(within(ms).queryByTestId("integration-reauth")).toBeNull();
    const grant = within(ms).getByTestId("integration-grant");
    expect(grant.textContent).toContain("Myönnetyt oikeudet (3)");
    expect(
      within(grant)
        .getAllByTestId("integration-not-granted")
        .map((r) => r.textContent),
    ).toEqual([
      "–Files.ReadWrite.Allpyydettiin, ei myönnetty",
      "–Mail.Sendpyydettiin, ei myönnetty",
    ]);
    const g = view.getByTestId("integration-account-google");
    expect(
      within(g).getByTestId("integration-account-narrowed").textContent,
    ).toContain("Kirjautuessa jäi myöntämättä: Google Drive");
    expect(within(g).getByTestId("integration-grant").textContent).toContain(
      "gmail.modify",
    );
    await userEvent.click(within(g).getByTestId("integration-reauth"));
    expect(onSignInAgain).toHaveBeenCalledTimes(1);
  });

  it("offers another account of a connected provider and a new sign-in for a rejected password", async () => {
    const onConnect = vi.fn();
    const onSignInAgain = vi.fn();
    const view = render(
      <IntegrationsOverview
        list={list}
        checking={new Set()}
        onCheck={noop}
        onConnect={onConnect}
        onSignInAgain={onSignInAgain}
        onRemove={noop}
      />,
    );
    const card = view.getByTestId(/^integration-account-/);

    await userEvent.click(within(card).getByTestId("integration-reauth"));
    expect(onSignInAgain).toHaveBeenCalledWith(list.accounts[0]);
    await userEvent.click(view.getByTestId("integration-add-imap"));
    expect(onConnect).toHaveBeenCalledWith(imap);
    // Google has no account yet: it is a tile to connect, not "another".
  });

  it("says a connected account is on hold while the server's app is out of use, and offers no sign-in", () => {
    const account = {
      provider: "microsoft" as const,
      address: "person@example.test",
      checked_at: "2026-10-24T12:00:00Z",
      services: [{ id: "mail" as const, state: "login_expired" as const }],
    };
    const microsoft = (available: boolean): Provider => ({
      id: "microsoft",
      available,
      login: "device_code",
      services: ["onedrive", "mail"],
      ...(available ? {} : { unavailable_reason: "app_credentials_required" }),
    });
    const show = (available: boolean) =>
      render(
        <IntegrationsOverview
          list={{
            ...list,
            providers: [microsoft(available)],
            accounts: [account],
          }}
          checking={new Set()}
          onCheck={noop}
          onConnect={noop}
          onSignInAgain={noop}
          onRemove={noop}
        />,
      );
    const off = show(false);
    const card = off.getByTestId("integration-account-microsoft");
    expect(
      within(card).getByTestId("integration-account-unavailable"),
    ).toBeTruthy();
    expect(within(card).queryByTestId("integration-reauth")).toBeNull();
    expect(within(card).getByTestId("integration-remove-open")).toBeTruthy();
    off.unmount();
    const on = show(true);
    expect(on.queryByTestId("integration-account-unavailable")).toBeNull();
    expect(on.getByTestId("integration-reauth")).toBeTruthy();
  });

  it.each([
    ["tenant_changed", true],
    ["app_changed", true],
    ["outside_tenant", false],
  ] as const)(
    "says once why an account could not follow the server's app (%s); sign-in offered: %s",
    (failure, signIn) => {
      const view = render(
        <IntegrationsOverview
          list={{
            ...list,
            providers: [
              {
                id: "microsoft",
                available: true,
                login: "device_code",
                services: ["onedrive", "mail"],
              },
            ],
            accounts: [
              {
                provider: "microsoft",
                address: "person@example.test",
                checked_at: "2026-10-24T12:00:00Z",
                services: [
                  { id: "onedrive", state: "login_expired", failure },
                  { id: "mail", state: "login_expired", failure },
                ],
              },
            ],
          }}
          checking={new Set()}
          onCheck={noop}
          onConnect={noop}
          onSignInAgain={noop}
          onRemove={noop}
        />,
      );
      const card = view.getByTestId("integration-account-microsoft");
      const notices = within(card).getAllByTestId(
        "integration-account-alignment",
      );
      expect(notices).toHaveLength(1);
      expect(notices[0].dataset.reason).toBe(failure);
      expect(!!within(card).queryByTestId("integration-reauth")).toBe(signIn);
    },
  );

  it.each(["initial_sync_incomplete", "initial_sync_resume_failed"] as const)(
    "says a first sync stopped midway (%s) and offers the sign-in that resumes it",
    async (failure) => {
      const onSignInAgain = vi.fn();
      const account = {
        provider: "dropbox" as const,
        address: "person@example.test",
        checked_at: "2026-10-24T07:53:00Z",
        services: [
          {
            id: "dropbox" as const,
            state: "sync_failed" as const,
            failure,
            directory: "~/cloud/dropbox/person@example.test",
          },
        ],
      };
      const view = render(
        <IntegrationsOverview
          list={{
            ...list,
            providers: [
              ...list.providers,
              {
                id: "dropbox",
                available: true,
                login: "pasted_redirect",
                services: ["dropbox"],
              },
            ],
            accounts: [account],
          }}
          checking={new Set()}
          onCheck={noop}
          onConnect={noop}
          onSignInAgain={onSignInAgain}
          onRemove={noop}
        />,
      );
      const card = view.getByTestId("integration-account-dropbox");

      expect(
        within(card).getByTestId("integration-service-state").dataset.failure,
      ).toBe(failure);
      expect(card.textContent).not.toContain("Tilaa ei saatu selville");
      expect(card.textContent).not.toContain("kiintiö");
      await userEvent.click(within(card).getByTestId("integration-reauth"));
      expect(onSignInAgain).toHaveBeenCalledWith(account);
    },
  );

  it("shows a file service's last successful pass and its running pass, not the status check", () => {
    const dropbox: Provider = {
      id: "dropbox",
      available: true,
      login: "pasted_redirect",
      services: ["dropbox"],
    };
    const service = (over: object) => ({
      provider: "dropbox" as const,
      address: "person@example.test",
      checked_at: "2026-10-24T08:45:00Z",
      services: [
        {
          id: "dropbox" as const,
          state: "ok" as const,
          directory: "~/cloud/dropbox/person@example.test",
          ...over,
        },
      ],
    });
    const show = (account: ReturnType<typeof service>) => {
      const { container } = render(
        <IntegrationsOverview
          list={{ ...list, providers: [dropbox], accounts: [account] }}
          checking={new Set()}
          onCheck={noop}
          onConnect={noop}
          onSignInAgain={noop}
          onRemove={noop}
        />,
      );
      return within(
        within(container).getByTestId("integration-service-dropbox"),
      );
    };

    const running = show(
      service({
        last_synced_at: "2026-10-24T08:44:14Z",
        progress: {
          service: "dropbox",
          phase: "transferring",
          elapsed_seconds: 4,
          bytes: 300,
          total_bytes: 1000,
          files: 3,
          total_files: 10,
        },
      }),
    );
    expect(
      running
        .getByTestId("integration-last-synced")
        .querySelector("time")
        ?.getAttribute("dateTime"),
    ).toBe("2026-10-24T08:44:14Z");
    expect(running.queryByTestId("integration-checked-at")).toBeNull();
    expect(running.getByTestId("integration-sync-progress")).toBeTruthy();
    // An ordinary pass is not the initial sync the person could stop.
    expect(running.queryByTestId("integration-sync-stop")).toBeNull();

    const never = show(service({}));
    expect(
      never.getByTestId("integration-last-synced").querySelector("time"),
    ).toBeNull();
    expect(never.queryByTestId("integration-sync-progress")).toBeNull();
  });

  it("names why an ordinary pass failed and keeps the last success visible", () => {
    const account = {
      provider: "google" as const,
      address: "person.home@example.test",
      checked_at: "2026-10-24T08:45:00Z",
      services: [
        {
          id: "drive" as const,
          state: "sync_restarting" as const,
          failure: "delete_limit" as const,
          last_synced_at: "2026-10-23T04:20:00Z",
          directory: "~/cloud/google-drive/person.home@example.test",
        },
      ],
    };
    const view = render(
      <IntegrationsOverview
        list={{ ...list, accounts: [account] }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );
    const row = within(view.getByTestId("integration-service-drive"));
    const state = row.getByTestId("integration-service-state");
    expect(state.getAttribute("data-failure")).toBe("delete_limit");
    expect(state.className).toContain("warn");
    expect(
      row
        .getByTestId("integration-last-synced")
        .querySelector("time")
        ?.getAttribute("dateTime"),
    ).toBe("2026-10-23T04:20:00Z");
    // A safeguard is not a rejected login: signing in again would not help.
    expect(view.queryByTestId("integration-reauth")).toBeNull();
  });

  it("does not offer the resyncing sign-in after a critical abort", () => {
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          accounts: [
            {
              provider: "google",
              address: "person.home@example.test",
              checked_at: "2026-10-24T08:45:00Z",
              services: [
                {
                  id: "drive",
                  state: "sync_failed",
                  failure: "needs_resync",
                  directory: "~/cloud/google-drive/person.home@example.test",
                },
              ],
            },
          ],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );
    expect(view.queryByTestId("integration-reauth")).toBeNull();
  });

  it("names a provider the operator has not installed instead of offering it", () => {
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          accounts: [],
          providers: [{ ...imap, available: false }],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );

    expect(
      (
        within(view.getByTestId("integration-tile-imap")).getByTestId(
          "integration-connect-open",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(view.getByTestId("integration-tile-imap").textContent).toContain(
      "Ei käytettävissä tällä palvelimella",
    );
  });

  it("says an installed provider waits for the administrator's app settings", () => {
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          accounts: [],
          providers: [
            {
              ...google,
              available: false,
              unavailable_reason: "app_credentials_required",
            },
          ],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );
    const tile = view.getByTestId("integration-tile-google");

    expect(tile.textContent).toContain(
      "Odottaa palvelimen ylläpitäjän sovellusasetuksia",
    );
    expect(
      (
        within(tile).getByTestId(
          "integration-connect-open",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("inside onboarding leaves the page's lead and warning to the step and its dialog", () => {
    const props = {
      list: { ...list, accounts: [], providers: [google] },
      checking: new Set<string>(),
      onCheck: noop,
      onConnect: noop,
      onSignInAgain: noop,
      onRemove: noop,
    };
    const page = render(<IntegrationsOverview {...props} />);
    expect(page.queryByRole("note")).not.toBeNull();
    page.unmount();
    const step = render(<IntegrationsOverview {...props} compact />);
    expect(step.queryByRole("note")).toBeNull();
    expect(step.queryByRole("heading")).toBeNull();
    expect(step.getByTestId("integration-tile-google")).toBeTruthy();
  });
});

const paste: LoginView = {
  schema_version: 1,
  state: "open_url",
  attempt_id: "20261019T094000.000000002",
  provider: "google",
  relogin: false,
  expires_at: new Date(Date.now() + 300_000).toISOString(),
  authorization_url: "https://accounts.example.test/o/oauth2/auth?state=s",
  redirect_prefix: "http://127.0.0.1",
};

function dialog(
  view: LoginView,
  handlers: Partial<Parameters<typeof ConnectDialog>[0]> = {},
) {
  return render(
    <ConnectDialog
      provider={google}
      stage={{ stage: "login", view }}
      onContinue={noop}
      onPassword={noop}
      onPaste={noop}
      onFolders={noop}
      onRestart={noop}
      onClose={noop}
      {...handlers}
    />,
  );
}

describe("sign-in dialog", () => {
  it("refuses the provider's own page before anything is sent", async () => {
    const onPaste = vi.fn();
    const view = dialog(paste, { onPaste });
    const open = view.getByRole("link");
    expect(open.getAttribute("rel")).toBe("noopener noreferrer");
    await userEvent.click(open);
    const field = view.getByRole("textbox");
    await userEvent.type(
      field,
      "https://accounts.example.test/signin/oauth/consent?x=1",
    );
    await userEvent.click(view.getByTestId("integration-connect"));
    expect(onPaste).not.toHaveBeenCalled();
    expect(view.getByRole("alert")).toBeTruthy();
    await userEvent.clear(field);
    await userEvent.type(
      field,
      "http://127.0.0.1:46399/oauth2/callback?state=s&code=c",
    );
    await userEvent.click(view.getByTestId("integration-connect"));
    expect(onPaste).toHaveBeenCalledWith(
      "http://127.0.0.1:46399/oauth2/callback?state=s&code=c",
    );
  });

  it("will not start a sync that does not fit the home", async () => {
    const onFolders = vi.fn();
    const view = dialog(
      {
        ...paste,
        state: "choose_folders",
        authorization_url: undefined,
        redirect_prefix: undefined,
        expires_at: undefined,
        address: "person.home@example.test",
        directory: "~/cloud/google-drive/person.home@example.test",
        free_bytes: 10 * 1024 ** 3,
        quota_bytes: 50 * 1024 ** 3,
        folders: [
          {
            id: "own",
            name: "Oma Drive",
            bytes: 4 * 1024 ** 3,
            suggested: true,
          },
          {
            id: "photos",
            name: "Kuvat",
            bytes: 31 * 1024 ** 3,
            suggested: false,
          },
        ],
      },
      { onFolders },
    );
    // Each step on its own row, the second current.
    const steps = view.getByRole("list").querySelectorAll("li");
    expect(steps).toHaveLength(2);
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    await userEvent.click(
      within(view.getByTestId("integration-folder-photos")).getByRole(
        "checkbox",
      ),
    );

    const start = view.getByTestId(
      "integration-sync-start",
    ) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await userEvent.click(
      within(view.getByTestId("integration-folder-photos")).getByRole(
        "checkbox",
      ),
    );
    await userEvent.click(start);
    expect(onFolders).toHaveBeenCalledWith(["own"]);
  });

  it("leads a drive larger than the home to its folders or to no files", async () => {
    const onFolders = vi.fn();
    const onSkipFolders = vi.fn();
    const view = dialog(
      {
        ...paste,
        state: "choose_folders",
        authorization_url: undefined,
        redirect_prefix: undefined,
        expires_at: undefined,
        address: "person.home@example.test",
        directory: "~/cloud/google-drive/person.home@example.test",
        free_bytes: 13 * 1024 ** 3,
        folders: [
          {
            id: "all",
            name: "Koko Google Drive",
            bytes: 25 * 1024 ** 3,
            estimated: true,
            whole: true,
            suggested: false,
          },
          { id: "work", name: "Työ", bytes: 3 * 1024 ** 3, suggested: false },
          { id: "photos", name: "Kuvat", measuring: true, suggested: false },
        ],
      },
      { onFolders, onSkipFolders },
    );
    expect(view.getByTestId("integration-folders-too-big")).toBeTruthy();
    const box = (id: string) =>
      within(view.getByTestId(`integration-folder-${id}`)).getByRole(
        "checkbox",
      ) as HTMLInputElement;
    expect(box("all").checked).toBe(false);
    const start = view.getByTestId(
      "integration-sync-start",
    ) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    // The whole drive and a folder of it are never chosen together.
    await userEvent.click(box("work"));
    await userEvent.click(box("all"));
    expect(box("work").checked).toBe(false);
    // An estimate over the room warns but does not forbid: the files are
    // counted before anything is copied.
    expect(start.disabled).toBe(false);
    await userEvent.click(box("work"));
    expect(box("all").checked).toBe(false);
    await userEvent.click(start);
    expect(onFolders).toHaveBeenCalledWith(["work"]);
    await userEvent.click(view.getByTestId("integration-sync-skip"));
    expect(onSkipFolders).toHaveBeenCalled();
  });

  it("offers no way past the files for a provider that has only files", () => {
    const view = render(
      <ConnectDialog
        provider={{ ...google, id: "dropbox", services: ["dropbox"] }}
        stage={{
          stage: "login",
          view: {
            ...paste,
            provider: "dropbox",
            state: "choose_folders",
            authorization_url: undefined,
            redirect_prefix: undefined,
            expires_at: undefined,
            address: "person@example.test",
            directory: "~/cloud/dropbox/person@example.test",
            free_bytes: 1024,
            folders: [{ id: "all", name: "Dropbox", suggested: true }],
          },
        }}
        onContinue={noop}
        onPassword={noop}
        onPaste={noop}
        onFolders={noop}
        onSkipFolders={noop}
        onRestart={noop}
        onClose={noop}
      />,
    );
    expect(view.queryByTestId("integration-sync-skip")).toBeNull();
  });

  it("shows an administrator consent link as text to send, never as a sign-in", () => {
    const view = dialog({
      schema_version: 1,
      state: "failed",
      attempt_id: "20261019T094000.000000001",
      provider: "microsoft",
      failure: "consent_required",
      consent_url:
        "https://login.example.test/contoso/adminconsent?client_id=x",
    });
    expect(
      view.getByText(
        "https://login.example.test/contoso/adminconsent?client_id=x",
      ),
    ).toBeTruthy();
    expect(view.queryByRole("link")).toBeNull();
  });
});

describe("app password form", () => {
  // Brave 1.96 kills the whole browser on the third typed character of a
  // field Chromium cannot classify, once a saved address matches it and
  // Brave adds its email-alias entry. Every text field must name what it
  // holds, including the SMTP fields that appear only after typing a server.
  it.each(["imap", "caldav", "carddav"] as const)(
    "gives every %s text field an autocomplete token",
    async (id) => {
      const view = render(
        <ConnectDialog
          provider={{ ...imap, id }}
          stage={{ stage: "password" }}
          onContinue={noop}
          onPassword={noop}
          onPaste={noop}
          onFolders={noop}
          onRestart={noop}
          onClose={noop}
        />,
      );
      if (id === "imap")
        await userEvent.type(
          view.getByTestId("integration-smtp-host"),
          "smtp.example.test",
        );
      const fields = [
        ...view.baseElement.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >("input, textarea"),
      ].filter((f) => !["checkbox", "radio", "hidden"].includes(f.type));
      expect(fields.length).toBeGreaterThan(id === "imap" ? 6 : 3);
      for (const field of fields)
        expect(field.getAttribute("autocomplete"), field.outerHTML).toMatch(
          /\S/,
        );
    },
  );
});

describe("removal", () => {
  it("offers the Trash only for synced folders and keeps them by default", async () => {
    const onConfirm = vi.fn();
    const view = render(
      <RemoveDialog
        account={{
          provider: "google",
          address: "p@example.test",
          checked_at: "2026-10-19T06:38:00Z",
          services: [
            { id: "mail", state: "ok" },
            {
              id: "drive",
              state: "ok",
              directory: "~/cloud/google-drive/p@example.test",
            },
          ],
        }}
        onConfirm={onConfirm}
        onClose={noop}
      />,
    );
    expect(view.getByRole("checkbox")).toBeTruthy();
    await userEvent.click(view.getByTestId("integration-remove-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(false);
    view.unmount();
    const plain = render(
      <RemoveDialog
        account={list.accounts[0]}
        onConfirm={noop}
        onClose={noop}
      />,
    );
    expect(plain.queryByRole("checkbox")).toBeNull();
  });
});

describe("Gitea in the overview", () => {
  const gitea: Provider = {
    id: "gitea",
    available: false,
    unavailable_reason: "tool_unavailable",
    missing_tools: ["tea"],
    login: "personal_token",
    services: ["git"],
  };
  it("offers no Gitea tile until the installation ships tea", () => {
    const view = render(
      <IntegrationsOverview
        list={{ ...list, providers: [imap, gitea] }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );
    expect(view.queryByTestId("integration-tile-gitea")).toBeNull();
    view.rerender(
      <IntegrationsOverview
        list={{ ...list, providers: [imap, { ...gitea, available: true }] }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );
    expect(view.getByTestId("integration-tile-gitea")).toBeTruthy();
  });

  it("still offers Gitea while another tool's accounts cannot be read", async () => {
    const onConnect = vi.fn();
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          skill: "failed",
          providers: [
            { ...google, accounts_unreadable: true },
            imap,
            { ...gitea, available: true },
          ],
          gitea: { state: "ok", connections: [] },
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={onConnect}
        onSignInAgain={noop}
        onRemove={noop}
      />,
    );
    const notice = view.getByTestId("integration-unreadable-google");
    expect(notice.textContent).toContain("Googlen tilejä ei voitu lukea");
    expect(notice.textContent).toContain("~/.config/rclone");
    expect(view.queryByTestId("integration-tile-google")).toBeNull();
    expect(view.queryByTestId("integration-unreadable-imap")).toBeNull();
    expect(view.getByText(/ennen kuin kaikkien palvelujen tilit/)).toBeTruthy();
    await userEvent.click(
      within(view.getByTestId("integration-tile-gitea")).getByRole("button"),
    );
    expect(onConnect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "gitea" }),
    );
  });

  it("shows tea's connections, and an unsupported one without actions", async () => {
    const onGitea = vi.fn();
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          providers: [{ ...gitea, available: true }],
          gitea: {
            state: "ok",
            connections: [
              {
                id: "gitea_0123456789abcdef01234567",
                base_url: "https://git.example.test",
                user: "person",
                kind: "pat",
                owned: true,
                ambiguous: false,
                git: "absent",
              },
              {
                id: "gitea_89abcdef0123456789abcdef",
                base_url: "https://git.example.test",
                user: "person2",
                kind: "oauth",
                owned: false,
                ambiguous: false,
                git: "absent",
              },
            ],
          },
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
        onGitea={onGitea}
      />,
    );
    const [pat, oauth] = view.getAllByTestId("gitea-connection");
    await userEvent.click(within(pat).getByTestId("gitea-repair"));
    expect(onGitea).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "repair" }),
    );
    expect(within(oauth).queryByTestId("gitea-disconnect-open")).toBeNull();
    expect(within(oauth).getByTestId("gitea-unsupported")).toBeTruthy();
  });
});

describe("account levels", () => {
  const dropbox: Provider = {
    id: "dropbox",
    available: true,
    login: "pasted_redirect",
    services: ["dropbox"],
    levels: [
      { id: "full", available: true },
      { id: "app_folder", available: false },
      { id: "read", available: true },
    ],
  };
  const full: Account = {
    provider: "dropbox",
    address: "person@example.test",
    checked_at: "2026-10-28T06:38:00Z",
    level: "full",
    services: [
      {
        id: "dropbox",
        state: "ok",
        access: "full",
        directory: "~/cloud/dropbox/person@example.test",
      },
    ],
    grant: { granted: ["files.content.write"], not_granted: [] },
  };
  const intro = (
    account: Account | undefined,
    onContinue: (level?: string) => void,
  ) =>
    render(
      <ConnectDialog
        provider={dropbox}
        stage={{ stage: "intro", account }}
        onContinue={onContinue}
        onPassword={noop}
        onPaste={noop}
        onFolders={noop}
        onRestart={noop}
        onClose={noop}
      />,
    );

  it("signs in at the chosen level, and a level without the server's app cannot be chosen", async () => {
    const onContinue = vi.fn();
    const view = intro(undefined, onContinue);
    const radio = (id: string) =>
      within(view.getByTestId(`integration-level-${id}`)).getByRole(
        "radio",
      ) as HTMLInputElement;
    expect(radio("full").checked).toBe(true);
    expect(radio("app_folder").disabled).toBe(true);
    await userEvent.click(view.getByTestId("integration-level-app_folder"));
    expect(radio("full").checked).toBe(true);
    await userEvent.click(view.getByTestId("integration-level-read"));
    await userEvent.click(view.getByTestId("integration-continue"));
    expect(onContinue).toHaveBeenCalledWith("read");
  });

  it("changes an account's level only to another one, and says what the change does", async () => {
    const onContinue = vi.fn();
    const view = intro(full, onContinue);
    const go = view.getByTestId("integration-continue") as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await userEvent.click(view.getByTestId("integration-level-read"));
    expect(view.getByTestId("integration-level-change")).toBeTruthy();
    expect(go.disabled).toBe(false);
    await userEvent.click(go);
    expect(onContinue).toHaveBeenCalledWith("read");
  });

  it("shows Google's drafts level as one Google does not offer, and a change revokes first", async () => {
    const levelled: Provider = {
      ...google,
      levels: [
        { id: "full", available: true },
        { id: "drafts", available: false, reason: "not_offered" },
        { id: "read", available: true },
      ],
    };
    const account: Account = {
      provider: "google",
      address: "person.home@example.test",
      checked_at: "2026-10-28T06:38:00Z",
      level: "full",
      services: [
        { id: "mail", state: "ok", access: "full" },
        {
          id: "drive",
          state: "ok",
          access: "full",
          directory: "~/cloud/google-drive/person.home@example.test",
        },
      ],
      grant: { granted: [], not_granted: [] },
    };
    const onContinue = vi.fn();
    const view = render(
      <ConnectDialog
        provider={levelled}
        stage={{ stage: "intro", account }}
        onContinue={onContinue}
        onPassword={noop}
        onPaste={noop}
        onFolders={noop}
        onRestart={noop}
        onClose={noop}
      />,
    );
    const drafts = view.getByTestId("integration-level-drafts");
    expect(
      (within(drafts).getByRole("radio") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(drafts.textContent).toContain("Google ei tarjoa tätä tasoa");
    expect(drafts.textContent).not.toContain("ylläpitäjä");
    await userEvent.click(view.getByTestId("integration-level-read"));
    expect(view.baseElement.textContent).toContain(
      "peruu vanhan kirjautumisen Googlessa ennen kuin kirjaudut uudelleen",
    );
    expect(view.baseElement.textContent).toContain("muuttuu peiliksi");
    await userEvent.click(view.getByTestId("integration-continue"));
    expect(onContinue).toHaveBeenCalledWith("read");
  });

  it("names an account's level from its grant", () => {
    const narrowed: Account = {
      provider: "microsoft",
      address: "person@work.example.test",
      checked_at: "2026-10-28T06:38:00Z",
      services: [
        { id: "onedrive", state: "unknown", access: "none" },
        { id: "mail", state: "ok", access: "drafts" },
        { id: "calendar", state: "ok", access: "full" },
      ],
      grant: { granted: ["Mail.ReadWrite"], not_granted: ["Mail.Send"] },
    };
    const read: Account = {
      ...narrowed,
      address: "reader@work.example.test",
      services: [
        { id: "onedrive", state: "unknown", access: "none" },
        { id: "mail", state: "ok", access: "read" },
        { id: "calendar", state: "ok", access: "read" },
      ],
    };
    const microsoft: Provider = {
      id: "microsoft",
      available: true,
      login: "device_code",
      services: ["onedrive", "mail", "calendar"],
      levels: [{ id: "full", available: true }],
    };
    const googleAccount: Account = {
      provider: "google",
      address: "person.home@example.test",
      checked_at: "2026-10-28T06:38:00Z",
      services: [
        { id: "mail", state: "ok", access: "full" },
        { id: "drive", state: "unknown", access: "none" },
      ],
      grant: {
        granted: ["https://www.googleapis.com/auth/gmail.modify"],
        not_granted: ["https://www.googleapis.com/auth/drive"],
      },
    };
    const onChangeLevel = vi.fn();
    const view = render(
      <IntegrationsOverview
        list={{
          schema_version: 1,
          providers: [dropbox, microsoft, google],
          skill: "current",
          accounts: [full, narrowed, read, googleAccount],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onChangeLevel={onChangeLevel}
        onRemove={noop}
      />,
    );
    const levels = view
      .getAllByTestId("integration-account-level")
      .map((p) => p.dataset.level);
    // A grant that is a level with a service left out, and one that is
    // none of them.
    expect(levels).toEqual(["full", "custom", "custom", "custom"]);
    const googleCard = view.getByTestId("integration-account-google");
    expect(
      within(googleCard).getByTestId("integration-account-level").textContent,
    ).toBe("Täysi, ilman: Google Drive");
    // The Google provider here lists no levels, so there is no change.
    expect(
      within(googleCard).queryByTestId("integration-change-level"),
    ).toBeNull();
    within(view.getByTestId("integration-account-dropbox"))
      .getByTestId("integration-change-level")
      .click();
    expect(onChangeLevel).toHaveBeenCalledWith(full);
  });
});

describe("Microsoft without a folder step", () => {
  const microsoft: Provider = {
    id: "microsoft",
    available: true,
    login: "device_code",
    services: ["onedrive", "sharepoint", "mail", "calendar", "contacts"],
    levels: [
      { id: "full", available: true },
      { id: "read", available: true },
    ],
  };
  const dialog = (stage: Parameters<typeof ConnectDialog>[0]["stage"]) =>
    render(
      <ConnectDialog
        provider={microsoft}
        stage={stage}
        onContinue={noop}
        onPassword={noop}
        onPaste={noop}
        onFolders={noop}
        onRestart={noop}
        onClose={noop}
      />,
    );

  it("says before signing in that files are searched, not synchronized", () => {
    const view = dialog({ stage: "intro" });
    const text = view.baseElement.textContent ?? "";
    expect(text).toContain("Microsoftin haulla");
    expect(text).not.toContain("Synkronoituu kotihakemistoosi");
    expect(text).not.toContain("OneDriven tai Dropboxin");
  });

  it("finishes the sign-in with no folder step or step counter", () => {
    const view = dialog({
      stage: "login",
      view: {
        schema_version: 1,
        state: "completed",
        attempt_id: "20261114T120000.000000000",
        provider: "microsoft",
        relogin: false,
        address: "person@example.test",
      },
    });
    expect(view.getByTestId("integration-connected")).toBeTruthy();
    expect(view.queryByTestId("integration-steps")).toBeNull();
    expect(view.baseElement.textContent).not.toContain("pilvikansioita");
  });

  it("shows the files as reached on demand, and a level change of a synced account keeps its folders", async () => {
    const searched: Account = {
      provider: "microsoft",
      address: "person@example.test",
      checked_at: "2026-11-14T06:38:00Z",
      level: "full",
      services: [
        { id: "onedrive", state: "ok", access: "full" },
        { id: "mail", state: "ok", access: "full" },
      ],
      grant: { granted: [], not_granted: [] },
    };
    const view = render(
      <IntegrationsOverview
        list={{
          schema_version: 1,
          providers: [microsoft],
          skill: "current",
          accounts: [searched],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onChangeLevel={noop}
        onRemove={noop}
      />,
    );
    const card = view.getByTestId("integration-account-microsoft");
    expect(card.textContent).toContain("Microsoftin haulla");
    expect(card.textContent).not.toContain("Ei synkronoida");
    view.unmount();

    // Without a synced folder a level change says nothing of folders.
    const plain = dialog({ stage: "intro", account: searched });
    await userEvent.click(plain.getByTestId("integration-level-read"));
    expect(plain.baseElement.textContent).not.toContain("peiliksi");
    plain.unmount();

    const synced: Account = {
      ...searched,
      services: [
        {
          id: "onedrive",
          state: "ok",
          access: "full",
          directory: "~/cloud/onedrive/person@example.test",
        },
        { id: "mail", state: "ok", access: "full" },
      ],
    };
    const change = dialog({ stage: "intro", account: synced });
    await userEvent.click(change.getByTestId("integration-level-read"));
    const text = change.baseElement.textContent ?? "";
    expect(text).toContain("Jo synkronoituvat kansiot jatkavat peileinä");
    expect(text).not.toContain("Valitset kansiot uudelleen");
  });
});
