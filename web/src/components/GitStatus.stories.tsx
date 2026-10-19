import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import "../app/WorkspacePage.css";
import { type GitDetailFacts, GitStatusDetails } from "./GitStatus";
import { WorkspaceGitLayer } from "./WorkspaceGitLayer";

const detail: GitDetailFacts = {
  branch: "main",
  upstream: "origin/main",
  ahead: 0,
  behind: 8,
  dirty_count: 0,
  files: [],
  files_truncated: false,
  commits: [],
  commits_available: true,
  fetched_at: 1790000000,
};
function Panel(args: React.ComponentProps<typeof GitStatusDetails>) {
  const [open, setOpen] = useState(true);
  return (
    <WorkspaceGitLayer
      label="main · 0 muutosta ↓8"
      title="Git · aurinkokello"
      open={open}
      onOpenChange={setOpen}
    >
      <GitStatusDetails {...args} embedded />
    </WorkspaceGitLayer>
  );
}
const meta = {
  title: "Production/Git details actions",
  component: GitStatusDetails,
  render: (args) => <Panel {...args} />,
  args: {
    summary: detail,
    detail,
    now: 1790000000 * 1000 + 25 * 60000,
    loading: false,
    readError: false,
    fetching: false,
    onFetch: () => {},
    onReread: () => {},
  },
  parameters: {
    docs: {
      description: {
        component:
          "Tuotannon Git-paneeli. Synteettiset näyttötilat; toiminnot eivät aja Gitiä. Puhelinleveydellä sama paneeli on alareunan sheet.",
      },
    },
  },
} satisfies Meta<typeof GitStatusDetails>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BeforeFetch: Story = {};
export const Incoming: Story = {
  args: { fetchMessage: "Etätiedot haettu. origin/main: 8 tulossa." },
};
export const UpToDate: Story = {
  args: {
    summary: { ...detail, behind: 0 },
    detail: { ...detail, behind: 0 },
    fetchMessage: "Etätiedot haettu. origin/main: 0 tulossa.",
  },
};
export const Fetching: Story = { args: { fetching: true } };
export const FetchFailed: Story = {
  args: {
    fetchFailed: true,
    fetchMessage: "Haku epäonnistui: etärepoon ei saatu yhteyttä.",
  },
};
