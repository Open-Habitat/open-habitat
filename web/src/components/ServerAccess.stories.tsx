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
  },
];
const view: AccessView = {
  schema_version: 1,
  mode: "allowlist",
  runtime_admission: true,
  entries,
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
    <div className="s-card" style={{ maxWidth: 900, margin: 24 }}>
      <ServerAccess
        view={view}
        lookup={lookup}
        onAdd={() => {}}
        onRemove={() => {}}
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
 * whose broker reply never came. Try `lauri-k` in the field. */
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
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};
