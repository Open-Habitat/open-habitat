import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  CloneCard,
  type CloneCardView,
  type DetailsState,
  type PushState,
  type RepoChoice,
  RepoDetails,
  RepoFinder,
} from "./ClonePage";
import { arrange, type CatalogRepo, type Since } from "./repoCatalog";

// Synthetic states of Uusi työtila's production components with GitLab's
// nested group projects in the common list (proto-gitlab-connect, Koko
// polku): each namespace, however deep, is its own section and the row names
// the project; search and the details show the whole path. No catalog is
// read and no clone runs.

const now = Date.parse("2026-10-27T08:00:00Z");
const intent = () => {};
const com = {
  provider: "gitlab" as const,
  id: "gitlab_0123456789abcdef01234567",
  label: "gitlab.com",
  login: "aino.virtanen",
};
type Row = CatalogRepo & { workspace?: RepoChoice["workspace"] };
const hours = (h: number) => new Date(now - h * 3600000).toISOString();
const repo = (full_name: string, extra: Partial<Row> = {}): Row => ({
  full_name,
  private: true,
  visibility: "private",
  description: "",
  pushed_at: hours(30),
  size_kib: 2900,
  default_branch: "main",
  owner_type: "User",
  source: com,
  group: true,
  ...extra,
});
const catalog: Row[] = [
  repo("esimerkki/notes", {
    source: undefined,
    group: undefined,
    visibility: undefined,
    description: "Muistiinpanot GitHubissa",
  }),
  repo("aino.virtanen/dotfiles", {
    group: false,
    owned: true,
    description: "Shell- ja editoriasetukset",
    pushed_at: hours(5),
  }),
  repo("konepaja/verkkokauppa/api", {
    description: "Verkkokaupan REST-rajapinta",
    pushed_at: hours(2),
  }),
  repo("konepaja/verkkokauppa/infra/terraform", {
    description: "Pilvi-infra",
    visibility: "internal",
    private: true,
  }),
  repo("konepaja/verkkokauppa/infra/ansible", {
    description: "Palvelinten asennus",
    size_kib: null,
    pushed_at: hours(190),
  }),
  repo("konepaja/sisainen/uusi-palvelu", {
    description: "Aloitettu, ei vielä committeja",
    empty: true,
    pushed_at: null,
    default_branch: null,
  }),
  repo("konepaja/vanhat/intranet-2019", {
    archived: true,
    pushed_at: hours(9000),
  }),
];
const choices: RepoChoice[] = catalog.map((r) => ({ ...r, href: "#" }));

function Finder({ initial = "" }: { initial?: string }) {
  const [query, setQuery] = useState(initial);
  const [since, setSince] = useState<Since>("0");
  return (
    <div className="ah-clone-page">
      <section className="ah-clone-card" aria-label="Työtilan lähde">
        <div className="ah-clone-pick">
          <RepoFinder
            arrangement={arrange(choices, {
              login: "esimerkki",
              query,
              since,
              now,
              taken: () => false,
            })}
            query={query}
            onQuery={setQuery}
            since={since}
            onSince={setSince}
            now={now}
            state="ready"
            mixed
            sourceNotes={[
              {
                key: "elsewhere",
                text: "GitLab gitlab.yritys.fi: 3 projektia jäi pois, koska palvelin ilmoittaa niiden osoitteeksi http://gitlab.internal, eikä Habitat lähetä tunnusta sinne. GitLabin ylläpitäjän pitää korjata external_url.",
                failed: false,
              },
            ]}
          />
          <RepoDetails
            now={now}
            state={{ kind: "ready" }}
            mode="full"
            onMode={intent}
            onClone={intent}
          />
        </div>
      </section>
    </div>
  );
}

function Details({
  pick,
  state = { kind: "ready" },
  push,
  cloneReason,
}: {
  pick: CatalogRepo;
  state?: DetailsState;
  push?: PushState;
  cloneReason?: string;
}) {
  return (
    <div className="ah-clone-page">
      <section className="ah-clone-card" aria-label="Työtilan lähde">
        <div className="ah-clone-pick" data-selected="">
          <RepoFinder
            arrangement={arrange(choices, {
              query: "",
              since: "0",
              now,
              taken: () => false,
            })}
            query=""
            onQuery={intent}
            since="0"
            onSince={intent}
            now={now}
            state="ready"
            mixed
          />
          <RepoDetails
            repo={pick}
            now={now}
            back="#"
            free={{ free_bytes: 18e9, limit_bytes: 20e9 }}
            state={state}
            push={push}
            mode="full"
            onMode={intent}
            onClone={intent}
            cloneReason={cloneReason}
          />
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Production/Uusi työtila · GitLab",
  component: Finder,
  parameters: {
    docs: {
      description: {
        component:
          "Uusi työtila -sivun tuotantokomponentit GitLabin sisäkkäisillä ryhmäpoluilla: jokainen nimiavaruus on oma osionsa ja rivillä on projektin nimi (Koko polku). Synteettinen data, ei verkkoa eikä kloonausta.",
      },
    },
  },
} satisfies Meta<typeof Finder>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NestedSections: Story = {};
export const SearchByGroup: Story = { args: { initial: "infra" } };
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const NestedDetails: Story = {
  render: () => <Details pick={catalog[3]} push="yes" />,
};
export const SizeUnknownReadOnly: Story = {
  render: () => <Details pick={catalog[4]} push="no" />,
};
export const ExpiredToken: Story = {
  render: () => (
    <Details
      pick={catalog[3]}
      push="expired"
      cloneReason="GitLab-tunnus on vanhentunut. Vaihda se Koodipalveluissa ennen kloonausta."
    />
  ),
};
export const EmptyProject: Story = {
  render: () => (
    <Details
      pick={catalog[5]}
      cloneReason="Repo on tyhjä, joten sitä ei voi vielä kloonata työtilaksi."
    />
  ),
};

const source = {
  provider: "gitlab" as const,
  connection_id: com.id,
  repository_id: 43,
};
const jobs: CloneCardView[] = [
  {
    kind: "job",
    full_name: "konepaja/verkkokauppa/infra/terraform",
    source,
    mode: "full",
    state: "running",
    stage: "receiving",
    percent: 42,
    received_bytes: 3_400_000,
  },
  {
    kind: "job",
    full_name: "pankki-oy/digi/mobiilisovellus",
    source: { ...source, repository_id: 44 },
    mode: "full",
    state: "failed",
    reason: "auth_refused",
    leftover: "removed",
  },
  {
    kind: "interrupted",
    full_name: "konepaja/sisainen/wiki",
    size_bytes: 120_000,
    source: { provider: "gitlab", connection_id: com.id },
  },
];
/** Running, refused by an SSO group, and interrupted. */
export const GitLabJobs: Story = {
  render: () => (
    <div className="ah-clone-page">
      <section className="ah-clone-jobs" aria-label="Kloonaukset">
        {jobs.map((view, i) => (
          <CloneCard
            key={view.full_name}
            view={view}
            onCancel={intent}
            onRetry={intent}
            onDismiss={intent}
            onRemove={intent}
            onRestart={i === 2 ? intent : undefined}
          />
        ))}
      </section>
    </div>
  ),
};
