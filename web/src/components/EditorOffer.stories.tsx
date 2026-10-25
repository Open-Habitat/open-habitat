import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorOfferCard } from "./EditorOffer";
import { ViewTray } from "./ViewPanel";

const offer = {
  offer_id: "44444444-4444-4444-8444-444444444444",
  workspace_id: "ws_example123",
  path: "internal/daemon/editor_linux.go",
  line: 547,
  created_at: "2026-10-25T12:00:00Z",
};

const meta = {
  title: "Conversation/Editor offer",
  component: EditorOfferCard,
  args: { offer, state: "ready", onOpen: () => {} },
} satisfies Meta<typeof EditorOfferCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Offered: Story = {};
export const WholeFile: Story = {
  args: { offer: { ...offer, path: "README.md", line: undefined } },
};
export const Unavailable: Story = { args: { state: "unavailable" } };
export const AccountTray: Story = {
  render: (args) => (
    <ViewTray>
      <EditorOfferCard
        {...args}
        workspaceName="open-habitat"
        onDismiss={() => {}}
      />
      <EditorOfferCard
        {...args}
        offer={{ ...offer, offer_id: "55555555-5555-4555-8555-555555555555" }}
        state="elsewhere"
        workspaceName="fleetrepo"
        onGoToWorkspace={() => {}}
        onDismiss={() => {}}
      />
    </ViewTray>
  ),
};
