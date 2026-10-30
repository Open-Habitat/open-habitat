import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Account, IntegrationList, Provider } from "../app/integrations";
import { AppleGuide } from "./AppleIntegration";
import { IntegrationsOverview } from "./Integrations";

const provider = (id: Provider["id"], services: Provider["services"]) =>
  ({ id, available: true, login: "app_password", services }) as Provider;
const at = "2026-10-24T09:41:00Z";
const contacts: Account = {
  provider: "carddav",
  address: "person@example.test",
  apple_id: "person@example.test",
  checked_at: at,
  services: [{ id: "contacts", state: "ok" }],
};
const mail: Account = {
  provider: "imap",
  address: "person@icloud.com",
  apple_id: "person@example.test",
  checked_at: at,
  services: [{ id: "mail", state: "credentials_rejected" }],
};
const nextcloud: Account = {
  provider: "carddav",
  address: "nc@example.test",
  checked_at: at,
  services: [{ id: "contacts", state: "ok" }],
};
const list: IntegrationList = {
  schema_version: 1,
  skill: "current",
  providers: [
    provider("apple", ["mail", "calendar", "contacts"]),
    provider("imap", ["mail"]),
    provider("carddav", ["contacts"]),
  ],
  accounts: [nextcloud, contacts, mail],
};
const noop = () => {};

describe("Apple (iCloud) card", () => {
  it("shows an Apple ID's accounts in one card, apart from the generic ones, and offers what is missing", async () => {
    const onApple = vi.fn();
    const view = render(
      <IntegrationsOverview
        list={list}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
        onApple={onApple}
      />,
    );
    const card = view.getByTestId("integration-apple-card");
    expect(
      within(card)
        .getAllByTestId(/^integration-service-(mail|calendar|contacts)$/)
        .map((e) => e.dataset.testid),
    ).toEqual(["integration-service-mail", "integration-service-contacts"]);
    // The Nextcloud CardDAV account stays a generic card of its own.
    expect(view.getAllByTestId("integration-account-carddav")).toHaveLength(1);
    expect(view.queryByTestId("integration-account-imap")).toBeNull();

    await userEvent.click(within(card).getByTestId("integration-apple-add"));
    expect(onApple).toHaveBeenLastCalledWith({
      kind: "add",
      appleId: "person@example.test",
      missing: ["calendar"],
    });
    // A rejected service asks for one new password for every service.
    await userEvent.click(within(card).getByTestId("integration-apple-renew"));
    expect(onApple).toHaveBeenLastCalledWith({
      kind: "renew",
      appleId: "person@example.test",
      services: ["mail", "contacts"],
    });
    await userEvent.click(within(card).getByTestId("integration-remove-open"));
    expect(onApple).toHaveBeenLastCalledWith({
      kind: "remove",
      appleId: "person@example.test",
      services: ["mail", "contacts"],
    });
  });
});

describe("Apple card beside an unreadable tool", () => {
  it("claims no service is missing and offers no add or renewal", () => {
    const view = render(
      <IntegrationsOverview
        list={{
          ...list,
          skill: "failed",
          providers: [
            {
              ...provider("apple", ["mail", "calendar", "contacts"]),
              accounts_unreadable: true,
            },
            provider("imap", ["mail"]),
            { ...provider("caldav", ["calendar"]), accounts_unreadable: true },
            provider("carddav", ["contacts"]),
          ],
        }}
        checking={new Set()}
        onCheck={noop}
        onConnect={noop}
        onSignInAgain={noop}
        onRemove={noop}
        onApple={vi.fn()}
      />,
    );
    const card = view.getByTestId("integration-apple-card");
    expect(within(card).getByTestId("integration-service-mail")).toBeTruthy();
    expect(within(card).queryByTestId("integration-apple-missing")).toBeNull();
    expect(within(card).queryByTestId("integration-apple-renew")).toBeNull();
    expect(view.getByTestId("integration-unreadable-apple")).toBeTruthy();
  });
});

describe("Apple guide", () => {
  it("adds services with the stored password, never asking for or sending one", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <AppleGuide
        mode={{
          kind: "add",
          appleId: "person@example.test",
          missing: ["mail", "calendar"],
          have: ["contacts"],
        }}
        stage={{ stage: "steps" }}
        onSubmit={onSubmit}
        onClose={noop}
      />,
    );
    await userEvent.click(view.getByTestId("apple-want-calendar"));
    await userEvent.click(view.getByTestId("apple-next"));
    expect(view.queryByTestId("apple-password")).toBeNull();
    // Mail signs in with an iCloud address; this Apple ID is not one.
    expect(
      (view.getByTestId("apple-connect") as HTMLButtonElement).disabled,
    ).toBe(true);
    await userEvent.type(
      view.getByTestId("apple-mail-address"),
      "Person@iCloud.com",
    );
    await userEvent.click(view.getByTestId("apple-connect"));
    expect(onSubmit).toHaveBeenCalledWith({
      appleId: "person@example.test",
      services: ["mail"],
      password: undefined,
      mailAddress: "person@icloud.com",
    });
  });

  it("asks for a password once the stored one is refused", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <AppleGuide
        mode={{
          kind: "add",
          appleId: "person@icloud.com",
          missing: ["calendar"],
          have: ["contacts"],
        }}
        stage={{ stage: "steps", askPassword: true, error: "refused" }}
        onSubmit={onSubmit}
        onClose={noop}
      />,
    );
    expect(view.getByTestId("apple-step-password")).toBeTruthy();
    await userEvent.click(view.getByTestId("apple-next"));
    await userEvent.type(
      view.getByTestId("apple-password"),
      "abcd-efgh-ijkl-mnop",
    );
    await userEvent.click(view.getByTestId("apple-connect"));
    expect(onSubmit).toHaveBeenCalledWith({
      appleId: "person@icloud.com",
      services: ["calendar"],
      password: "abcd-efgh-ijkl-mnop",
      mailAddress: undefined,
    });
  });

  it("renews every service of the Apple ID with one password", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <AppleGuide
        mode={{
          kind: "renew",
          appleId: "person@icloud.com",
          services: ["mail", "contacts"],
        }}
        stage={{ stage: "steps" }}
        onSubmit={onSubmit}
        onClose={noop}
      />,
    );
    await userEvent.click(view.getByTestId("apple-next"));
    await userEvent.type(view.getByTestId("apple-password"), "new-password");
    expect(view.getByTestId("apple-looks-wrong")).toBeTruthy();
    await userEvent.click(view.getByTestId("apple-connect"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        appleId: "person@icloud.com",
        services: ["mail", "contacts"],
        password: "new-password",
      }),
    );
  });
});
