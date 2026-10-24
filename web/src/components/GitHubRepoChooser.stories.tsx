import type { Meta, StoryObj } from "@storybook/react-vite";
import { type GitHubRepoChoice, GitHubRepoChooser } from "./GitHubRepoChooser";
import { OnboardingRoute } from "./OnboardingFrame";
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
    onToggle: onIntent,
    onProceed: onIntent,
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
export const Continuing: Story = {
  args: {
    view: catalog,
    selectedNames: repos.map((repo) => repo.full_name),
    busy: true,
  },
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
        size="row"
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
/** The Kartta route when the server offers Google: it is a step of its own. */
export const RouteWithGoogle: Story = {
  args: { ...Selected.args },
  decorators: [
    (Story) => (
      <OnboardingRoute
        steps={[
          { id: "github", note: "Kirjautunut" },
          { id: "repositories" },
          { id: "google" },
          { id: "ai" },
        ]}
      >
        <Story />
      </OnboardingRoute>
    ),
  ],
};
/** Automatic checkout: the site's defaults are already being fetched and stay
 * in the chooser as locked forced selections; the person can add others. */
export const LockedDefaults: Story = {
  args: {
    view: {
      phase: "catalog",
      repositories: [
        {
          full_name: "northstar-demo/team-workspace",
          private: true,
          pushed_at: "2026-10-20T08:00:00Z",
          description: "Tiimin yhteinen työtila.",
        },
        ...repos,
      ],
    },
    locked: [
      {
        full_name: "northstar-demo/team-workspace",
        status: "Sivusto hakee · 42 %",
      },
    ],
    selectedNames: [repos[1].full_name],
  },
};
