import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationList, LoginView, Provider } from "../app/integrations";
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
