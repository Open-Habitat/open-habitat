import type { Meta, StoryObj } from "@storybook/react-vite";
import type {
  AccessEntry,
  AccessView,
  LookupResult,
} from "../app/serverAccess";
import { ServerAccess } from "./ServerAccess";

// Synthetic states of the production Asetukset › Käyttäjät ja pääsy tab
// (proto-admin-server-onboarding round 6, Yksi lista). The lookup answers
// from a fixed directory; no host or broker is involved.
const entries: AccessEntry[] = [
  {
    id: "51234000",
    source: "operator",
    state: "joined",
    username: "kaisa",
    login_hint: "kaisa-admin",
    last_seen: "2026-10-24T08:00:00Z",
    administrator: true,
    denied: false,
    administrator_role: { source: "operator", state: "granted" },
  },
  {
    id: "51234001",
    source: "site_admin",
    state: "joined",
    username: "maija",
    login_hint: "maija-esim",
    at: "2026-10-20T08:00:00Z",
    last_seen: "2026-10-23T08:00:00Z",
    administrator: false,
    denied: false,
    onboarding: {
      at: "2026-10-22T08:00:00Z",
      mode: "auto",
      defaults: [
        { repository: "northstar-demo/handbook", outcome: "queued" },
        { repository: "northstar-demo/site", outcome: "already_present" },
        { repository: "northstar-demo/infra", outcome: "no_access" },
      ],
      ai_key: "seeded",
    },
  },
  {
    id: "51234003",
    source: "site_admin",
    state: "allowed",
    login_hint: "northstar-ops",
    at: "2026-10-22T08:00:00Z",
    administrator: false,
    denied: false,
  },
  {
    id: "51234004",
    source: "site_admin",
    state: "withdrawn",
    username: "ville",
    login_hint: "ville-vanha",
    at: "2026-10-20T08:00:00Z",
    administrator: false,
    denied: true,
  },
  {
    id: "51234002",
    source: "site_admin",
    state: "joined",
    username: "teppo",
    login_hint: "teppo-esim",
    administrator: false,
    denied: true,
    onboarding: {
      at: "2026-10-21T08:00:00Z",
      mode: "preselected",
      defaults: [
        { repository: "northstar-demo/handbook", outcome: "preselected" },
        { repository: "northstar-demo/site", outcome: "preselected" },
      ],
      ai_key: "not_offered",
    },
  },
];
const view: AccessView = {
  schema_version: 1,
  mode: "allowlist",
  runtime_admission: true,
  teams: [],
  entries,
};
// A team admits people beside those allowed one by one (proto-org-admission,
// Syy riveillä): a member, someone with both reasons, a leaver raised as a
// notice, and one whose membership GitHub could not confirm.
const team = "northstar-demo/kehitys";
const teamEntries: AccessEntry[] = [
  ...entries,
  {
    id: "51234010",
    source: "team",
    state: "joined",
    username: "aino",
    login_hint: "aino-v",
    at: "2026-11-01T08:00:00Z",
    last_seen: "2026-11-02T08:00:00Z",
    administrator: false,
    denied: false,
    team_state: "member",
    teams: [team],
  },
  {
    id: "51234011",
    source: "site_admin",
    state: "joined",
    username: "mikko",
    login_hint: "mikko-k",
    at: "2026-10-14T08:00:00Z",
    administrator: false,
    denied: false,
    team_state: "member",
    teams: [team],
  },
  {
    id: "51234012",
    source: "team",
    state: "left",
    username: "tuuli",
    login_hint: "tuuli-h",
    at: "2026-11-02T07:00:00Z",
    administrator: false,
    denied: false,
    team_state: "left",
    teams: [team],
  },
  {
    id: "51234013",
    source: "team",
    state: "unconfirmed",
    username: "lauri",
    login_hint: "lauri-p",
    at: "2026-11-02T06:00:00Z",
    administrator: false,
    denied: false,
    team_state: "unconfirmed",
    teams: [team],
  },
];
const teamView: AccessView = {
  ...view,
  teams: [
    {
      org_id: "71234000",
      org: "northstar-demo",
      slug: "kehitys",
      pinned: true,
      actor: "51234000",
      at: "2026-10-31T08:00:00Z",
    },
  ],
  entries: teamEntries,
};
const lookup = async (login: string): Promise<LookupResult> =>
  login.toLowerCase() === "lauri-k"
    ? {
        kind: "found",
        user: { id: "51234006", login: "lauri-k", name: "Lauri Koskinen" },
      }
    : { kind: "refused", code: "github_user_not_found" };

function Tab(props: Partial<Parameters<typeof ServerAccess>[0]>) {
  return (
    <div style={{ maxWidth: 900, margin: 24 }}>
      <ServerAccess
        view={view}
        lookup={lookup}
        onAdd={async () => ({ kind: "changed" })}
        onRemove={() => {}}
        onRole={() => {}}
        onRefresh={() => {}}
        {...props}
      />
    </div>
  );
}

const meta = {
  title: "Settings/Käyttäjät ja pääsy",
  component: Tab,
} satisfies Meta<typeof Tab>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Administrator, user, not yet signed in, access removed, and a removal
 * whose broker reply never came; two rows carry their sign-in receipt. Try
 * `lauri-k` in the field. */
export const EveryState: Story = {};
export const Pending: Story = {
  args: {
    pending: {
      "51234006": { kind: "add", login: "lauri-k", name: "Lauri Koskinen" },
      "51234001": { kind: "remove" },
      "51234004": { kind: "restore" },
    },
  },
};
export const Uncertain: Story = {
  args: { pending: { "51234003": { kind: "uncertain" } } },
};
export const Refused: Story = {
  args: {
    problem: { id: "51234001", text: "Sallittujen lista on täynnä." },
  },
};
export const RuntimeSwitchOff: Story = {
  args: { view: { ...view, runtime_admission: false } },
};
export const OpenMode: Story = {
  args: { view: { ...view, mode: "any" } },
};
/** GitHub did not answer when the gateway resolved the operator row's
 * login: the row says so and shows the id as the only distinguishing fact. */
export const UnresolvedLogin: Story = {
  args: {
    view: {
      ...view,
      entries: entries.map(({ login_hint, ...e }) =>
        e.source === "operator" ? e : { ...e, login_hint },
      ),
    },
  },
};
/** Sign-in receipts whose answers went missing or failed: the daemon's
 * reply was lost, a check did not finish, and the site key did not take. */
export const ReceiptProblems: Story = {
  args: {
    view: {
      ...view,
      entries: entries.map((e) =>
        e.id === "51234001"
          ? {
              ...e,
              onboarding: {
                at: "2026-10-22T08:00:00Z",
                mode: "skip",
                defaults: [
                  { repository: "northstar-demo/handbook", outcome: "unknown" },
                  { repository: "northstar-demo/site", outcome: "unknown" },
                  {
                    repository: "northstar-demo/infra",
                    outcome: "check_failed",
                  },
                ],
                ai_key: "failed",
              },
            }
          : e,
      ),
    },
  },
};
/** An administrator named someone who has not signed in yet, and someone
 * who has; both roles are revocable here, site.json's is not. */
export const DesignatedAdministrators: Story = {
  args: {
    view: {
      ...view,
      entries: entries.map((e) =>
        e.id === "51234003"
          ? {
              ...e,
              administrator_role: {
                source: "site_admin",
                state: "pending",
                actor: "51234000",
                at: "2026-10-30T08:00:00Z",
              },
            }
          : e.id === "51234001"
            ? {
                ...e,
                administrator: true,
                administrator_role: {
                  source: "site_admin",
                  state: "granted",
                  actor: "51234000",
                  at: "2026-10-29T08:00:00Z",
                },
              }
            : e,
      ),
    },
    pending: { "51234002": { kind: "grant" } },
  },
};
/** A team as an admission source: reasons as chips, a leaver as a notice
 * above the list. Try `northstar-demo/myynti` in the field. */
export const Team: Story = {
  args: { view: teamView, onAddTeam: async () => ({ kind: "changed" }) },
};
/** GitHub did not answer the membership question, and a just-added team no
 * member has signed in through yet. */
export const TeamUnavailable: Story = {
  args: {
    view: {
      ...teamView,
      teams: [
        { ...teamView.teams[0], unavailable_at: "2026-11-02T06:00:00Z" },
        {
          org_id: "71234000",
          org: "northstar-demo",
          slug: "myynti",
          pinned: false,
          actor: "51234000",
          at: "2026-11-02T08:00:00Z",
        },
      ],
    },
    onAddTeam: async () => ({ kind: "changed" }),
  },
};
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};
