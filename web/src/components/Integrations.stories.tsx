import type { Meta, StoryObj } from "@storybook/react-vite";
import type { IntegrationList, LoginView, Provider } from "../app/integrations";
import {
  ConnectDialog,
  type ConnectStage,
  IntegrationsOverview,
  RemoveDialog,
} from "./Integrations";

// Synthetic states of the production Integraatiot components (ADR 0026,
// prototype direction "Tili"). No daemon, tool or provider is involved; the
// Google and Microsoft accounts stand in for entries still to be built.
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
const microsoft: Provider = {
  id: "microsoft",
  available: true,
  login: "device_code",
  services: ["mail", "calendar", "contacts", "onedrive"],
};
const dropbox: Provider = {
  id: "dropbox",
  available: false,
  login: "pasted_redirect",
  services: ["dropbox"],
};
const checked = "2026-10-19T06:38:00Z";
const intent = () => {};

const connected: IntegrationList = {
  schema_version: 1,
  providers: [google, microsoft, imap, dropbox],
  skill: "current",
  accounts: [
    {
      provider: "google",
      address: "person.home@example.test",
      checked_at: checked,
      services: [
        { id: "mail", state: "ok" },
        { id: "calendar", state: "ok" },
        { id: "contacts", state: "ok" },
        {
          id: "drive",
          state: "ok",
          directory: "~/cloud/google-drive/person.home@example.test",
        },
      ],
    },
    {
      provider: "imap",
      address: "person@example.test",
      checked_at: checked,
      services: [{ id: "mail", state: "ok" }],
    },
  ],
};

const meta = {
  title: "Production/Integraatiot",
  component: IntegrationsOverview,
  parameters: {
    docs: {
      description: {
        component:
          "Asetukset › Integraatiot synteettisillä tiloilla. Ei daemonia, työkaluja eikä palveluntarjoajia; tila on annettu näyttömalli.",
      },
    },
  },
  args: {
    list: connected,
    checking: new Set<string>(),
    onCheck: intent,
    onConnect: intent,
    onSignInAgain: intent,
    onStopSync: intent,
    onRemove: intent,
  },
} satisfies Meta<typeof IntegrationsOverview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const Empty: Story = {
  args: { list: { ...connected, accounts: [], skill: "none" } },
};
export const Checking: Story = { args: { checking: "all" } };
export const ExpiredAndFailing: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        {
          ...connected.accounts[0],
          services: [
            { id: "mail", state: "login_expired" },
            { id: "calendar", state: "login_expired" },
            {
              id: "drive",
              state: "sync_restarting",
              directory: "~/cloud/google-drive/person.home@example.test",
            },
          ],
        },
        {
          provider: "imap",
          address: "person@example.test",
          checked_at: checked,
          services: [{ id: "mail", state: "credentials_rejected" }],
        },
        {
          provider: "microsoft",
          address: "person@work.example.test",
          checked_at: checked,
          services: [
            {
              id: "onedrive",
              state: "quota_full",
              directory: "~/cloud/onedrive/person@work.example.test",
            },
          ],
        },
      ],
    },
  },
};
export const ForeignSkill: Story = {
  args: { list: { ...connected, skill: "blocked" } },
};

const soon = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();
const base = {
  schema_version: 1 as const,
  attempt_id: "20261019T094000.000000001",
  relogin: false,
};
const device: LoginView = {
  ...base,
  state: "device_code",
  provider: "microsoft",
  verification_uri: "https://login.microsoft.com/device",
  user_code: "K7QM2PXDW",
  expires_at: soon(15),
};
const pasteView: LoginView = {
  ...base,
  state: "open_url",
  provider: "google",
  authorization_url:
    "https://accounts.example.test/o/oauth2/auth?state=synthetic",
  redirect_prefix: "http://127.0.0.1",
  expires_at: soon(5),
};
const folders: LoginView = {
  ...base,
  state: "choose_folders",
  provider: "google",
  address: "person.home@example.test",
  directory: "~/cloud/google-drive/person.home@example.test",
  free_bytes: 37258212147,
  quota_bytes: 53687091200,
  folders: [
    { id: "own", name: "Oma Drive", bytes: 4617089843, suggested: true },
    {
      id: "shared",
      name: "Jaettu kanssani",
      bytes: 1932735283,
      suggested: true,
    },
    { id: "photos", name: "Kuvat", bytes: 33500744908, suggested: false },
  ],
};

const dialog = (provider: Provider, stage: ConnectStage) => () => (
  <ConnectDialog
    provider={provider}
    stage={stage}
    onContinue={intent}
    onPassword={intent}
    onPaste={intent}
    onFolders={intent}
    onRestart={intent}
    onClose={intent}
  />
);
export const DialogIntro: Story = {
  render: dialog(google, { stage: "intro" }),
};
export const DialogPassword: Story = {
  render: dialog(imap, { stage: "password" }),
};
export const DialogPasswordRejected: Story = {
  render: dialog(imap, {
    stage: "password",
    relogin: "person@example.test",
    error:
      "Palvelin ei hyväksynyt tunnusta tai salasanaa. Mitään ei tallennettu.",
  }),
};
export const DialogDeviceCode: Story = {
  render: dialog(microsoft, { stage: "login", view: device }),
};
export const DialogPaste: Story = {
  render: dialog(google, { stage: "login", view: pasteView }),
};
export const DialogFolders: Story = {
  render: dialog(google, { stage: "login", view: folders }),
};
export const DialogConsent: Story = {
  render: dialog(microsoft, {
    stage: "login",
    view: {
      ...base,
      state: "failed",
      provider: "microsoft",
      failure: "consent_required",
      consent_url:
        "https://login.microsoftonline.com/esimerkki.onmicrosoft.com/v2.0/adminconsent?client_id=synthetic",
    },
  }),
};
export const DialogBlocked: Story = {
  render: dialog(microsoft, {
    stage: "login",
    view: {
      ...base,
      state: "failed",
      provider: "microsoft",
      failure: "device_code_blocked",
    },
  }),
};
export const DialogExpired: Story = {
  render: dialog(google, {
    stage: "login",
    view: { ...base, state: "failed", provider: "google", failure: "expired" },
  }),
};
export const DialogCompleted: Story = {
  render: dialog(google, {
    stage: "login",
    view: {
      ...base,
      state: "completed",
      provider: "google",
      address: "person.home@example.test",
    },
  }),
};
export const RemoveWithFolder: Story = {
  render: () => (
    <RemoveDialog
      account={connected.accounts[0]}
      onConfirm={intent}
      onClose={intent}
    />
  ),
};

const nativeProgress = {
  phase: "transferring" as const,
  elapsed_seconds: 82,
  bytes: 2 * 1024 ** 3,
  total_bytes: 8 * 1024 ** 3,
  files: 214,
  total_files: 880,
};
export const DialogInitialSync: Story = {
  render: dialog(
    { ...dropbox, available: true },
    {
      stage: "login",
      view: {
        ...base,
        provider: "dropbox",
        state: "completing",
        address: "person@example.test",
        progress: nativeProgress,
      },
    },
  ),
};
export const BackgroundInitialSync: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        {
          provider: "dropbox",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "dropbox",
              state: "syncing",
              directory: "~/cloud/dropbox/person@example.test",
              progress: nativeProgress,
            },
          ],
        },
      ],
    },
  },
};
export const InitialSyncFailed: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        {
          provider: "dropbox",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "dropbox",
              state: "sync_failed",
              directory: "~/cloud/dropbox/person@example.test",
              progress: nativeProgress,
            },
          ],
        },
      ],
    },
  },
};
