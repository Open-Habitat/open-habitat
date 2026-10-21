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
    const card = view.getByTestId("integration-account");

    await userEvent.click(within(card).getByTestId("integration-sign-in"));
    expect(onSignInAgain).toHaveBeenCalledWith(list.accounts[0]);
    await userEvent.click(view.getByTestId("integration-connect-imap"));
    expect(onConnect).toHaveBeenCalledWith(imap);
    // Google has no account yet: it is a tile to connect, not "another".
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
      (view.getByTestId("integration-connect-imap") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
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
    await userEvent.click(view.getByTestId("integration-submit"));
    expect(onPaste).not.toHaveBeenCalled();
    expect(view.getByRole("alert")).toBeTruthy();
    await userEvent.clear(field);
    await userEvent.type(
      field,
      "http://127.0.0.1:46399/oauth2/callback?state=s&code=c",
    );
    await userEvent.click(view.getByTestId("integration-submit"));
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

    const start = view.getByTestId("integration-sync") as HTMLButtonElement;
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
    await userEvent.click(view.getByTestId("integration-remove"));
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
