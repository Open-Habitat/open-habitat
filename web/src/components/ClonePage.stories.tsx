import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  CloneCard,
  type CloneCardView,
  type DetailsState,
  type RepoChoice,
  RepoDetails,
  RepoFinder,
} from "./ClonePage";
import { arrange, type CatalogRepo, type Since } from "./repoCatalog";

// Synthetic states of Uusi työtila's production components with GitHub and
// connected Giteas in one list (workspace-import round 3, "Yhteinen lista",
// as an extension of the existing page). The same owner/name comes from
// GitHub, from one Gitea and from a second account of that Gitea, so the row
// chips, owner sections and details are what tell them apart. No catalog is
// read and no clone runs; the app's route, jobs and writes are absent.

const now = Date.parse("2026-10-24T09:00:00Z");
const intent = () => {};
const giteaA2 = {
  id: "gitea_b",
  label: "git.example.test (toinen)",
  login: "toinen",
};
const giteaAOwn = {
  id: "gitea_a",
  label: "git.example.test (esimerkki)",
  login: "esimerkki",
};
type Row = CatalogRepo & { workspace?: RepoChoice["workspace"] };
const repo = (full_name: string, extra: Partial<Row> = {}): Row => ({
  full_name,
  private: true,
  description: "",
  pushed_at: "2026-10-22T12:00:00Z",
  size_kib: 840,
  default_branch: "main",
  owner_type: "User",
  ...extra,
});
const catalog: Row[] = [
  repo("esimerkki/notes", {
    description: "Muistiinpanot GitHubissa",
    private: false,
  }),
  repo("esimerkki/site", { pushed_at: "2026-10-10T08:00:00Z" }),
  repo("esimerkki/notes", {
    description: "Muistiinpanot omalla Gitealla",
    source: giteaAOwn,
    owned: true,
    workspace: "same",
  }),
  repo("esimerkki/notes", {
    description: "Sama repo toisen tilin listassa",
    source: giteaA2,
    owned: false,
    workspace: "same",
  }),
  repo("esimerkki/blank", { source: giteaAOwn, owned: true, empty: true }),
  repo("tiimi/infra", {
    description: "Arkistoitu",
    source: giteaAOwn,
    owned: false,
    archived: true,
    pushed_at: "2026-06-01T08:00:00Z",
  }),
];
const choices: RepoChoice[] = catalog.map((r) => ({
  ...r,
  href: "#",
  mark: r.workspace === "same" ? { label: "työtilana", tone: "ok" } : undefined,
}));
const notes = {
  failed: {
    key: "gitea_c",
    text: "Gitean code.example.test (esimerkki) repoja ei saatu: Gitea hylkäsi tunnuksen.",
    failed: true,
  },
  incomplete: {
    key: "gitea_b",
    text: "Gitean git.example.test (toinen) lista on vajaa: lukeminen keskeytyi.",
    failed: false,
  },
};

function Finder({
  initial = "",
  sourceNotes = [notes.failed, notes.incomplete],
}: {
  initial?: string;
  sourceNotes?: { key: string; text: string; failed: boolean }[];
}) {
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
              taken: (r) => !!r.workspace,
            })}
            query={query}
            onQuery={setQuery}
            since={since}
            onSince={setSince}
            now={now}
            state="ready"
            mixed
            sourceNotes={sourceNotes}
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
  state,
  cloneReason,
  problem,
}: {
  pick: CatalogRepo;
  state: DetailsState;
  cloneReason?: string;
  problem?: string;
}) {
  return (
    <div className="ah-clone-page">
      <section className="ah-clone-card" aria-label="Työtilan lähde">
        <div className="ah-clone-pick" data-selected="">
          <RepoFinder
            arrangement={arrange(
              choices.map((c) => ({
                ...c,
                selected:
                  c.full_name === pick.full_name &&
                  c.source?.id === pick.source?.id,
              })),
              {
                login: "esimerkki",
                query: pick.full_name,
                since: "0",
                now,
                taken: () => false,
              },
            )}
            query={pick.full_name}
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
            mode="full"
            onMode={intent}
            onClone={intent}
            cloneReason={cloneReason}
            problem={problem}
          />
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Production/Uusi työtila · Gitea",
  component: Finder,
  parameters: {
    docs: {
      description: {
        component:
          "Uusi työtila -sivun tuotantokomponentit, kun GitHub ja Gitea ovat samassa listassa. Samanniminen repo tulee GitHubista, Giteasta ja saman Gitean toiselta tililtä; lähde näkyy rivin sirussa, omistajaosiossa ja tiedoissa. Synteettinen data, ei verkkoa eikä kloonausta.",
      },
    },
  },
} satisfies Meta<typeof Finder>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Browse: owner sections per source, one failed and one incomplete
 * source said beside the lists that stay whole. */
export const CommonList: Story = {};
/** Search: three esimerkki/notes rows, each with its own source. */
export const SameNameSearch: Story = { args: { initial: "notes" } };
export const AllSourcesWhole: Story = { args: { sourceNotes: [] } };
export const Narrow: Story = {
  args: { initial: "notes" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

const giteaNotes = catalog[2];
const githubNotes = catalog[0];
export const GiteaDetailsReady: Story = {
  render: () => <Details pick={giteaNotes} state={{ kind: "ready" }} />,
};
/** ~/src/notes is the Gitea clone: its GitHub namesake cannot be cloned
 * over it. */
export const GitHubNamesakeTaken: Story = {
  render: () => (
    <Details
      pick={githubNotes}
      state={{ kind: "taken", path: "~/src/notes" }}
    />
  ),
};
export const GiteaDetailsWorkspace: Story = {
  render: () => (
    <Details
      pick={giteaNotes}
      state={{ kind: "workspace", path: "~/src/notes", onOpen: intent }}
    />
  ),
};
export const GiteaOriginUnknown: Story = {
  render: () => (
    <Details
      pick={giteaNotes}
      state={{ kind: "taken", path: "~/src/notes", unknown: true }}
    />
  ),
};
export const GiteaEmpty: Story = {
  render: () => (
    <Details
      pick={catalog[4]}
      state={{ kind: "ready" }}
      cloneReason="Repo on tyhjä, joten sitä ei voi vielä kloonata työtilaksi."
    />
  ),
};
export const GiteaStartRefused: Story = {
  render: () => (
    <Details
      pick={giteaNotes}
      state={{ kind: "ready" }}
      problem="Git-asetuksesi (url.insteadOf) ohjaavat tämän repon osoitteen muualle, joten kloonausta ei aloitettu. Poista ohjaus Gitean osoitteelta ja yritä uudelleen."
    />
  ),
};

const source = {
  provider: "gitea" as const,
  connection_id: "gitea_a",
  repository_id: 2001,
};
const jobs: CloneCardView[] = [
  {
    kind: "job",
    full_name: "esimerkki/notes",
    source,
    mode: "full",
    state: "running",
    stage: "receiving",
    percent: 42,
    received_bytes: 3_400_000,
  },
  {
    kind: "job",
    full_name: "esimerkki/site",
    source: { ...source, repository_id: 2002 },
    mode: "full",
    state: "failed",
    reason: "native_failure",
    leftover: "removed",
  },
  {
    kind: "interrupted",
    full_name: "esimerkki/tools",
    size_bytes: 120_000,
    source: { provider: "gitea", connection_id: "gitea_a" },
  },
  {
    kind: "interrupted",
    full_name: "vanha/arkisto",
    size_bytes: 40_000,
    source: { provider: "gitea" },
  },
];
/** Running, failed, an interrupted clone whose connection still lists the
 * repository (restart and remove) and one whose connection is gone (remove
 * only). */
export const GiteaJobs: Story = {
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
