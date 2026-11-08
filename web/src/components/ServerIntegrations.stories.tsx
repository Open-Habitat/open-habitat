import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Provider, ProviderId } from "../app/integrations";
import type { IntegrationApps } from "../app/serverIntegrations";
import { MicrosoftLevelsDialog } from "./MicrosoftLevels";
import { AppSetupDialog, ServerIntegrations } from "./ServerIntegrations";

// Synthetic states of the production Palvelimen ylläpito › Palvelinintegraatiot tab
// (proto-server-integrations-setup, round 2 direction 2, Google's round 3
// direction 2 and Dropbox's round 5 direction 2; Microsoft's levels are
// proto-integration-levels round 5). No host, broker or provider is involved.
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
const needsApp = { unavailable_reason: "app_credentials_required" as const };
const rcloneMissing = {
  unavailable_reason: "tool_unavailable" as const,
  missing_tools: ["rclone"],
};
/** A new installation: the tools are there, no app credentials yet. */
const fresh: Provider[] = [
  provider("google", false, needsApp),
  provider("microsoft", false, needsApp),
  provider("apple", true),
  provider("imap", true),
  provider("caldav", true),
  provider("carddav", true),
  provider("dropbox", false, needsApp),
];
const googleSet: Provider[] = fresh.map((p) =>
  p.id === "google" ? provider("google", true) : p,
);
/** An old installation without rclone. */
const partial: Provider[] = fresh.map((p) =>
  p.id === "google" || p.id === "microsoft" || p.id === "dropbox"
    ? provider(p.id, false, rcloneMissing)
    : p,
);
const none: IntegrationApps = {
  schema_version: 1,
  browser_setup: true,
  apps: [],
};
const google: IntegrationApps = {
  ...none,
  apps: [
    {
      provider: "google",
      client_id:
        "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com",
      usable: true,
      source: "site_admin",
      actor: "51234000",
      at: "2026-10-24T12:00:00Z",
    },
  ],
};
const microsoftSet: Provider[] = googleSet.map((p) =>
  p.id === "microsoft" ? provider("microsoft", true) : p,
);
const googleAndMicrosoft: IntegrationApps = {
  ...google,
  apps: [
    ...google.apps,
    {
      provider: "microsoft",
      client_id: "3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031",
      tenant_id: "b81e5c27-4a93-4f0d-86c2-1d9e7a3f5b60",
      usable: true,
      source: "site_admin",
      actor: "51234000",
      at: "2026-10-24T12:00:00Z",
    },
  ],
};
const allSet: Provider[] = microsoftSet.map((p) =>
  p.id === "dropbox" ? provider("dropbox", true) : p,
);
const allApps: IntegrationApps = {
  ...googleAndMicrosoft,
  apps: [
    ...googleAndMicrosoft.apps,
    {
      provider: "dropbox",
      client_id: "p3n8vq1zt6ka0rw",
      usable: true,
      source: "site_admin",
      actor: "51234000",
      at: "2026-10-24T12:00:00Z",
    },
  ],
};
const save = async () => ({ kind: "changed" as const, view: google });

function Tab(props: Partial<Parameters<typeof ServerIntegrations>[0]>) {
  return (
    <div style={{ maxWidth: 900, margin: 24 }}>
      <ServerIntegrations
        providers={googleSet}
        apps={google}
        steps={["google", "microsoft", "apple"]}
        names={{ "51234000": "kaisa-admin" }}
        onboardingHref="#kayttoonotto"
        onSave={save}
        onRemove={() => {}}
        onRefresh={() => {}}
        {...props}
      />
    </div>
  );
}

const meta = {
  title: "Settings/Palvelinintegraatiot",
  component: Tab,
} satisfies Meta<typeof Tab>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Google set by an administrator; Microsoft and Dropbox waiting for theirs.
 * The Google step is in onboarding, Microsoft's hidden until it is ready. */
export const GoogleSet: Story = {};
/** Microsoft set too: its Tunnukset menu offers only removal. */
export const MicrosoftSet: Story = {
  args: { providers: microsoftSet, apps: googleAndMicrosoft },
};
/** Root's section from before the single-tenant app: common is ignored. */
export const MicrosoftAudienceKeyword: Story = {
  args: {
    providers: googleSet,
    apps: {
      ...google,
      apps: [
        ...google.apps,
        {
          provider: "microsoft",
          client_id: "3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031",
          tenant_id: "common",
          usable: false,
          source: "operator",
        },
      ],
    },
  },
};
/** Dropbox set too: its Tunnukset menu offers only removal and keeps the
 * Development-status rule (open the menu). */
export const DropboxSet: Story = {
  args: { providers: allSet, apps: allApps },
};
export const NewInstallation: Story = {
  args: { providers: fresh, apps: none },
};
/** rclone missing: Korjaa… gives the one command. */
export const ToolMissing: Story = {
  args: { providers: partial, apps: google },
};
export const Waiting: Story = {
  args: { providers: fresh, apps: none, pending: { google: "set" } },
};
export const Uncertain: Story = {
  args: { pending: { google: "uncertain" } },
};
export const RemovalRefused: Story = {
  args: {
    problem: {
      provider: "google",
      text: "Palvelinta huolletaan juuri nyt. Mitään ei muutettu; yritä hetken päästä uudelleen.",
    },
  },
};
export const BrowserSetupOff: Story = {
  args: { providers: fresh, apps: { ...none, browser_setup: false } },
};
export const CatalogUnreadable: Story = {
  args: { providers: undefined },
};
export const Phone: Story = {
  args: { providers: partial },
  globals: { viewport: { value: "mobile1" } },
};

/** Google's guided setup, one step at a time. */
function Setup(props: Partial<Parameters<typeof AppSetupDialog>[0]>) {
  return (
    <AppSetupDialog
      provider="google"
      onSave={save}
      onClose={() => {}}
      {...props}
    />
  );
}
export const GoogleStepAPIs: StoryObj<typeof Setup> = {
  render: () => <Setup step={0} />,
};
export const GoogleStepAudience: StoryObj<typeof Setup> = {
  render: () => <Setup step={1} />,
};
export const GoogleStepScopes: StoryObj<typeof Setup> = {
  render: () => <Setup step={2} />,
};
/** The last step: the client is created beside where its values go. */
export const GoogleStepClient: StoryObj<typeof Setup> = {
  render: () => <Setup step={3} />,
};
export const GoogleStepClientPhone: StoryObj<typeof Setup> = {
  render: () => <Setup step={3} />,
  globals: { viewport: { value: "mobile1" } },
};
/** Minulla on jo asiakas: only the values and where they are. */
export const GoogleExisting: StoryObj<typeof Setup> = {
  render: () => <Setup skip />,
};
export const GoogleNewSecret: StoryObj<typeof Setup> = {
  render: () => <Setup replace={google.apps[0]} />,
};
/** Microsoft's four levels, one guided setup: the start page is the
 * levels' table with a checkbox per missing level; the set ones are
 * skipped (proto-integration-levels round 5, Rastit taulukossa). */
function Levels(props: { apps?: IntegrationApps }) {
  return (
    <MicrosoftLevelsDialog
      apps={(props.apps ?? googleAndMicrosoft).apps}
      locked={false}
      line={(a) => a.client_id ?? ""}
      invalid={() => ""}
      onSave={save}
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
}
export const MicrosoftLevelsStart: StoryObj<typeof Levels> = {
  render: () => <Levels />,
};
export const MicrosoftLevelsNoneSet: StoryObj<typeof Levels> = {
  render: () => <Levels apps={google} />,
};
export const MicrosoftLevelsPhone: StoryObj<typeof Levels> = {
  render: () => <Levels />,
  globals: { viewport: { value: "mobile1" } },
};
/** Dropbox's guided setup: one App Console page per step, the keys beside
 * the Settings page. */
export const DropboxStepCreate: StoryObj<typeof Setup> = {
  render: () => <Setup provider="dropbox" step={0} />,
};
export const DropboxStepPermissions: StoryObj<typeof Setup> = {
  render: () => <Setup provider="dropbox" step={1} />,
};
export const DropboxStepSettings: StoryObj<typeof Setup> = {
  render: () => <Setup provider="dropbox" step={2} />,
};
export const DropboxStepPhone: StoryObj<typeof Setup> = {
  render: () => <Setup provider="dropbox" step={0} />,
  globals: { viewport: { value: "mobile1" } },
};
export const GoogleStepPhone: StoryObj<typeof Setup> = {
  render: () => <Setup step={2} />,
  globals: { viewport: { value: "mobile1" } },
};
