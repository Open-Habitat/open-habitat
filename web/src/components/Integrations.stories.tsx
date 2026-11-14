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
// Synthetic accounts exercise the production components.
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
          last_synced_at: "2026-10-19T06:37:12Z",
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
          "Asetukset › Tiedot agenteille synteettisillä tiloilla. Ei daemonia, työkaluja eikä palveluntarjoajia; tila on annettu näyttömalli.",
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
/** The server's Microsoft app went out of use under a connected account. */
export const ProviderOutOfUse: Story = {
  args: {
    list: {
      ...connected,
      providers: connected.providers.map((p) =>
        p.id === "microsoft"
          ? {
              ...p,
              available: false,
              unavailable_reason: "app_credentials_required" as const,
            }
          : p,
      ),
      accounts: [
        ...connected.accounts,
        {
          provider: "microsoft",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "onedrive",
              state: "unknown",
              directory: "~/cloud/onedrive/person@example.test",
            },
            { id: "mail", state: "unknown" },
          ],
        },
      ],
    },
  },
};
/** The server's Microsoft tenant refused the account's earlier sign-in. */
export const TenantRefused: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        ...connected.accounts,
        {
          provider: "microsoft",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "onedrive",
              state: "login_expired",
              failure: "tenant_changed",
              directory: "~/cloud/onedrive/person@example.test",
            },
            { id: "mail", state: "login_expired", failure: "tenant_changed" },
            {
              id: "calendar",
              state: "login_expired",
              failure: "tenant_changed",
            },
          ],
        },
      ],
    },
  },
};
/** The organisation consented to mail drafts but not to sending or files,
 * and the person left Drive out on Google's consent page. */
export const NarrowerGrant: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        {
          provider: "microsoft",
          address: "person@example.test",
          checked_at: checked,
          services: [
            { id: "onedrive", state: "unknown", access: "none" },
            { id: "sharepoint", state: "unknown", access: "none" },
            { id: "mail", state: "ok", access: "drafts" },
            { id: "calendar", state: "ok", access: "read" },
            { id: "contacts", state: "ok", access: "full" },
          ],
          grant: {
            granted: [
              "Calendars.Read",
              "Contacts.ReadWrite",
              "Mail.ReadWrite",
              "User.Read",
            ],
            not_granted: [
              "Calendars.ReadWrite",
              "Files.ReadWrite.All",
              "Mail.Send",
              "Sites.ReadWrite.All",
            ],
          },
        },
        {
          provider: "google",
          address: "person.home@example.test",
          checked_at: checked,
          services: [
            { id: "drive", state: "unknown", access: "none" },
            { id: "mail", state: "ok", access: "full" },
            { id: "calendar", state: "ok", access: "full" },
            { id: "contacts", state: "ok", access: "full" },
          ],
          grant: {
            granted: [
              "https://www.googleapis.com/auth/calendar",
              "https://www.googleapis.com/auth/contacts",
              "https://www.googleapis.com/auth/gmail.modify",
            ],
            not_granted: ["https://www.googleapis.com/auth/drive"],
          },
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
  login_phase: "files",
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
export const DialogMicrosoftFinishing: Story = {
  render: dialog(microsoft, {
    stage: "login",
    view: {
      ...base,
      provider: "microsoft",
      state: "completing",
      login_phase: "files_discovery",
    },
  }),
};
export const DialogMicrosoftConnected: Story = {
  render: dialog(microsoft, {
    stage: "login",
    view: {
      ...base,
      provider: "microsoft",
      state: "completed",
      address: "person@example.test",
    },
  }),
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
// An unclassified Graph failure must not claim consent or account incompatibility.
export const DialogMicrosoftUnclassifiedFailure: Story = {
  render: dialog(microsoft, {
    stage: "login",
    view: {
      ...base,
      state: "failed",
      provider: "microsoft",
      failure: "tool_failed",
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
export const DialogNothingGranted: Story = {
  render: dialog(google, {
    stage: "login",
    view: {
      ...base,
      state: "failed",
      provider: "google",
      failure: "nothing_granted",
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
// Outlook shares the first pass's native sign-in, so its services are
// checked after the pass instead of being reported as unknown.
export const MicrosoftFirstSync: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        {
          provider: "microsoft",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "onedrive",
              state: "syncing",
              directory: "~/cloud/onedrive/person@example.test",
              progress: { ...nativeProgress, service: "onedrive" },
            },
            { id: "sharepoint", state: "pending_first_sync" },
            { id: "mail", state: "pending_first_sync" },
            { id: "calendar", state: "pending_first_sync" },
            { id: "contacts", state: "pending_first_sync" },
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

// A working login whose first sync a daemon restart stopped.
export const InitialSyncIncomplete: Story = {
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
              failure: "initial_sync_incomplete",
              directory: "~/cloud/dropbox/person@example.test",
            },
          ],
        },
      ],
    },
  },
};

// The daemon resumed a first sync a restart stopped, and the resume failed.
export const InitialSyncResumeFailed: Story = {
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
              failure: "initial_sync_resume_failed",
              directory: "~/cloud/dropbox/person@example.test",
            },
          ],
        },
      ],
    },
  },
};

// Ordinary passes after the first sync: one running now with its native
// counters, one whose last pass hit bisync's mass-deletion safeguard, and one
// retrying after a network failure. Each shows its last successful pass.
export const OrdinaryPasses: Story = {
  args: {
    list: {
      ...connected,
      providers: [
        ...connected.providers.slice(0, 3),
        { ...dropbox, available: true },
      ],
      accounts: [
        {
          provider: "dropbox",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "dropbox",
              state: "ok",
              directory: "~/cloud/dropbox/person@example.test",
              last_synced_at: "2026-10-19T06:37:12Z",
              progress: {
                service: "dropbox",
                phase: "transferring",
                elapsed_seconds: 14,
                bytes: 36_700_160,
                total_bytes: 104_857_600,
                files: 3,
                total_files: 12,
              },
            },
          ],
        },
        {
          ...connected.accounts[0],
          services: [
            { id: "mail", state: "ok" },
            {
              id: "drive",
              state: "sync_restarting",
              failure: "delete_limit",
              directory: "~/cloud/google-drive/person.home@example.test",
              last_synced_at: "2026-10-18T21:04:00Z",
            },
          ],
        },
        {
          provider: "microsoft",
          address: "person@work.example.test",
          checked_at: checked,
          services: [
            {
              id: "onedrive",
              state: "sync_restarting",
              failure: "remote_unreachable",
              directory: "~/cloud/onedrive/person@work.example.test",
              last_synced_at: "2026-10-19T06:21:40Z",
            },
          ],
        },
      ],
    },
  },
};

export const FolderSizesPending: Story = {
  render: dialog(google, {
    stage: "login",
    view: {
      ...folders,
      free_bytes: undefined,
      folders: folders.folders?.map(({ bytes: _bytes, ...folder }) => folder),
    },
  }),
};
export const InventoryBeforeCopy: Story = {
  render: dialog(google, {
    stage: "login",
    view: {
      ...folders,
      state: "completing",
      progress: {
        phase: "inventory",
        elapsed_seconds: 12,
        bytes: 0,
        total_bytes: 0,
        files: 0,
        total_files: 0,
      },
    },
  }),
};

export const InventoryExceedsQuota: Story = {
  render: dialog(google, {
    stage: "login",
    view: { ...folders, state: "failed", failure: "quota_insufficient" },
  }),
};

export const BackgroundQuotaRefusal: Story = {
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
              failure: "quota_insufficient",
              directory: "~/cloud/dropbox/person@example.test",
            },
          ],
        },
      ],
    },
  },
};

// A Microsoft first pass refused before anything was copied: the files say
// why and how much was asked, also after the daemon restarted. SharePoint
// was left out of the choice.
export const MicrosoftRefusedFirstPass: Story = {
  args: {
    list: {
      ...connected,
      accounts: [
        {
          provider: "microsoft",
          address: "person@example.test",
          checked_at: checked,
          services: [
            {
              id: "onedrive",
              state: "sync_failed",
              failure: "quota_insufficient",
              needed_bytes: 220396051998,
              free_bytes: 42409644032,
              directory: "~/cloud/onedrive/person@example.test",
            },
            {
              id: "sharepoint",
              state: "sync_failed",
              failure: "not_chosen",
              directory: "~/cloud/sharepoint/contoso--person@example.test",
            },
            { id: "mail", state: "ok" },
            { id: "calendar", state: "ok" },
            { id: "contacts", state: "ok" },
          ],
        },
      ],
    },
  },
};

// Account levels: each a boundary the provider enforces. The server here has
// Microsoft's full and read applications but not the drafts one, and no
// Dropbox App folder application.
const microsoftLevels: Provider = {
  ...microsoft,
  services: ["onedrive", "sharepoint", "mail", "calendar", "contacts"],
  levels: [
    { id: "full", available: true },
    { id: "drafts", available: false, reason: "application_missing" },
    { id: "read", available: true },
  ],
};
// Google has no drafts level at all: Gmail's drafts scope sends too.
const googleLevels: Provider = {
  ...google,
  levels: [
    { id: "full", available: true },
    { id: "drafts", available: false, reason: "not_offered" },
    { id: "read", available: true },
  ],
};
const dropboxLevels: Provider = {
  ...dropbox,
  available: true,
  levels: [
    { id: "full", available: true },
    { id: "app_folder", available: false, reason: "application_missing" },
    { id: "read", available: true },
  ],
};
const leveled: IntegrationList = {
  schema_version: 1,
  providers: [googleLevels, microsoftLevels, dropboxLevels],
  skill: "current",
  accounts: [
    {
      provider: "google",
      address: "person.home@example.test",
      checked_at: checked,
      level: "full",
      services: [
        {
          id: "drive",
          state: "ok",
          access: "full",
          directory: "~/cloud/google-drive/person.home@example.test",
          last_synced_at: "2026-10-19T06:37:12Z",
        },
        { id: "mail", state: "ok", access: "full" },
        { id: "calendar", state: "ok", access: "full" },
        { id: "contacts", state: "ok", access: "full" },
      ],
      grant: {
        granted: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/contacts",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
        not_granted: [],
      },
    },
    {
      provider: "microsoft",
      address: "person@work.example.test",
      checked_at: checked,
      level: "read",
      services: [
        {
          id: "onedrive",
          state: "ok",
          access: "read",
          directory: "~/cloud/onedrive/person@work.example.test",
          last_synced_at: "2026-10-19T06:37:12Z",
        },
        { id: "mail", state: "ok", access: "read" },
        { id: "calendar", state: "ok", access: "read" },
        { id: "contacts", state: "ok", access: "read" },
      ],
      grant: {
        granted: [
          "Calendars.Read",
          "Contacts.Read",
          "Files.Read.All",
          "Mail.Read",
          "Sites.Read.All",
          "User.Read",
        ],
        not_granted: [],
      },
    },
    {
      provider: "dropbox",
      address: "person@example.test",
      checked_at: checked,
      level: "full",
      services: [
        {
          id: "dropbox",
          state: "ok",
          access: "full",
          directory: "~/cloud/dropbox/person@example.test",
          last_synced_at: "2026-10-19T06:37:12Z",
        },
      ],
      grant: {
        granted: ["files.content.read", "files.content.write"],
        not_granted: [],
      },
    },
  ],
};
export const Levels: Story = {
  args: { list: leveled, onChangeLevel: intent },
};
export const DialogLevels: Story = {
  render: dialog(microsoftLevels, { stage: "intro" }),
};
export const DialogChangeLevel: Story = {
  render: dialog(dropboxLevels, {
    stage: "intro",
    account: leveled.accounts[2],
  }),
};
export const DialogGoogleLevels: Story = {
  render: dialog(googleLevels, { stage: "intro" }),
};
export const DialogGoogleChangeLevel: Story = {
  render: dialog(googleLevels, {
    stage: "intro",
    account: leveled.accounts[0],
  }),
};
export const DialogRevokeFailed: Story = {
  render: dialog(googleLevels, {
    stage: "login",
    view: {
      ...base,
      state: "failed",
      provider: "google",
      relogin: true,
      address: "person.home@example.test",
      failure: "revoke_failed",
    },
  }),
};
export const DialogFinalSyncFailed: Story = {
  render: dialog(dropboxLevels, {
    stage: "login",
    view: {
      ...base,
      state: "failed",
      provider: "dropbox",
      relogin: true,
      address: "person@example.test",
      failure: "final_sync_failed",
    },
  }),
};
