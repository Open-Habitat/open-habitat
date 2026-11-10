import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Account, IntegrationList, Provider } from "../app/integrations";
import { AppleGuide, AppleRemoveDialog } from "./AppleIntegration";
import { IntegrationsOverview } from "./Integrations";

// Synthetic states of the Apple (iCloud) card and guide. No daemon, tool or
// Apple is involved; the accounts are what the daemon would list.
const provider = (
  id: Provider["id"],
  services: Provider["services"],
  available = true,
): Provider => ({
  id,
  available,
  login: "app_password",
  services,
  ...(available ? {} : { unavailable_reason: "app_credentials_required" }),
});
const providers = [
  provider("google", ["mail", "calendar", "contacts", "drive"], false),
  provider("apple", ["mail", "calendar", "contacts"]),
  provider("imap", ["mail"]),
  provider("caldav", ["calendar"]),
  provider("carddav", ["contacts"]),
];
const checked = "2026-10-24T09:41:00Z";
const appleId = "person@icloud.com";
const service = (
  p: "imap" | "caldav" | "carddav",
  state: "ok" | "credentials_rejected" = "ok",
): Account => ({
  provider: p,
  address: appleId,
  apple_id: appleId,
  checked_at: checked,
  services: [
    {
      id: p === "imap" ? "mail" : p === "caldav" ? "calendar" : "contacts",
      state,
    },
  ],
});
const list = (accounts: Account[]): IntegrationList => ({
  schema_version: 1,
  providers,
  skill: accounts.length ? "current" : "none",
  accounts,
});
const intent = () => {};

const meta = {
  title: "Production/Integraatiot/Apple",
  component: IntegrationsOverview,
  parameters: {
    docs: {
      description: {
        component:
          "Apple (iCloud) -kortti ja -ohje synteettisillä tiloilla. Kortti kootaan tavallisista imap-, caldav- ja carddav-tileistä niiden palvelimen perusteella.",
      },
    },
  },
  args: {
    list: list([]),
    checking: new Set<string>(),
    onCheck: intent,
    onConnect: intent,
    onSignInAgain: intent,
    onRemove: intent,
    onApple: intent,
  },
} satisfies Meta<typeof IntegrationsOverview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {};
/** A generic CardDAV connection to contacts.icloud.com joins the card. */
export const ContactsOnly: Story = {
  args: { list: list([service("carddav")]) },
};
export const AllServices: Story = {
  args: {
    list: list([service("imap"), service("caldav"), service("carddav")]),
  },
};
export const PasswordRevoked: Story = {
  args: {
    list: list([
      service("imap", "credentials_rejected"),
      service("caldav", "credentials_rejected"),
      service("carddav", "credentials_rejected"),
    ]),
  },
};

export const GuideNew: Story = {
  render: () => (
    <AppleGuide
      mode={{ kind: "new" }}
      stage={{ stage: "steps" }}
      onSubmit={intent}
      onClose={intent}
    />
  ),
};
export const GuideAddWithStoredPassword: Story = {
  render: () => (
    <AppleGuide
      mode={{
        kind: "add",
        appleId,
        missing: ["mail", "calendar"],
        have: ["contacts"],
      }}
      stage={{ stage: "steps" }}
      onSubmit={intent}
      onClose={intent}
    />
  ),
};
export const GuideStoredPasswordRefused: Story = {
  render: () => (
    <AppleGuide
      mode={{ kind: "add", appleId, missing: ["calendar"], have: ["contacts"] }}
      stage={{
        stage: "steps",
        askPassword: true,
        error:
          "Tallennettu sovellussalasana ei enää kelpaa. Luo uusi ja anna se tähän. Mitään ei tallennettu.",
      }}
      onSubmit={intent}
      onClose={intent}
    />
  ),
};
export const GuideRenew: Story = {
  render: () => (
    <AppleGuide
      mode={{
        kind: "renew",
        appleId,
        services: ["mail", "calendar", "contacts"],
      }}
      stage={{ stage: "steps" }}
      onSubmit={intent}
      onClose={intent}
    />
  ),
};
export const GuidePartialResult: Story = {
  render: () => (
    <AppleGuide
      mode={{ kind: "new" }}
      stage={{
        stage: "done",
        connected: ["calendar", "contacts"],
        failed: [{ service: "mail", failure: "credentials_rejected" }],
      }}
      onSubmit={intent}
      onClose={intent}
    />
  ),
};
export const Remove: Story = {
  render: () => (
    <AppleRemoveDialog
      appleId={appleId}
      services={["mail", "contacts"]}
      onConfirm={intent}
      onClose={intent}
    />
  ),
};
