import type { Meta, StoryObj } from "@storybook/react-vite";
import { GitHubRepoChooser, type GitHubRepoChoice } from "./GitHubRepoChooser";
import { Button } from "./Primitives";

const repos: GitHubRepoChoice[] = [
  {
    full_name: "sample-lab/aurora",
    private: true,
    pushed_at: "2026-09-28T12:00:00Z",
    description:
      "Pitkä esimerkkikuvaus: käyttöliittymän luonnokset ja paikalliset kokeilut.",
  },
  {
    full_name: "sample-lab/harbor",
    private: false,
    pushed_at: null,
    description: "<script>alert('text only')</script>",
  },
];
const onIntent = () => {};
const catalog = {
  phase: "catalog" as const,
  repositories: repos,
};
const meta = {
  title: "Production/GitHub first-use chooser",
  component: GitHubRepoChooser,
  parameters: {
    docs: {
      description: {
        component:
          "Synteettiset tilat tuotantokomponentista. Storyt eivät hae repoja eivätkä kirjoita levylle.",
      },
    },
  },
  args: {
    selectedNames: [],
    checkout: { phase: "idle" },
    onToggle: onIntent,
    onProceed: onIntent,
    onRecheck: onIntent,
  },
} satisfies Meta<typeof GitHubRepoChooser>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { args: { view: { phase: "loading" } } };
export const NoSelection: Story = { args: { view: catalog } };
export const Selected: Story = {
  args: {
    view: catalog,
    selectedNames: [repos[0].full_name],
  },
};
export const Empty: Story = {
  args: { view: { phase: "catalog", repositories: [] } },
};
export const NoAuth: Story = { args: { view: { phase: "no-auth" } } };
export const Unavailable: Story = {
  args: { view: { phase: "unavailable" }, onRefresh: onIntent },
};
export const Progress: Story = {
  args: {
    view: catalog,
    selectedNames: repos.map((repo) => repo.full_name),
    checkout: { phase: "progress", completed: 1, total: 2 },
  },
};
export const Partial: Story = {
  args: {
    ...Progress.args,
    checkout: { phase: "partial", completed: 1, total: 2 },
    onEditSelection: onIntent,
  },
};
export const Uncertain: Story = {
  args: { ...Progress.args, checkout: { phase: "uncertain" } },
};
export const SelectedNarrow: Story = {
  args: { ...Selected.args },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390 }}>
        <Story />
      </div>
    ),
  ],
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const FirstUseExitDanger: Story = {
  args: { ...Selected.args },
  render: (args) => (
    <main>
      <GitHubRepoChooser {...args} />
      <Button
        label="Keskeytä käyttöönotto ja kirjaudu ulos"
        variant="danger"
        onPress={onIntent}
      />
    </main>
  ),
};
export const FirstUseExitDangerNarrow: Story = {
  ...FirstUseExitDanger,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390 }}>
        <Story />
      </div>
    ),
  ],
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const Confirmed: Story = {
  args: {
    ...Progress.args,
    checkout: {
      phase: "confirmed",
      names: repos.map((repo) => repo.full_name),
    },
  },
};
