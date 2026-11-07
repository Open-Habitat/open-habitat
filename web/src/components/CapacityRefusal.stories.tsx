import type { Meta, StoryObj } from "@storybook/react";
import { CapacityRefusal } from "./CapacityRefusal";

const meta = {
  title: "Production/Capacity refusal",
  component: CapacityRefusal,
  args: {
    limit: 1,
    source: "installation",
    here: "aurinkokello",
    holders: [
      {
        agentId: "pi:synthetic",
        title: "Päivitä etusivu",
        workspaceName: "aurinkokello",
        activity: "turn",
      },
    ],
    room: false,
    tries: 0,
    admin: true,
    onRetry: () => {},
    onStop: () => {},
    onOpen: () => {},
    onAdmin: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: "24px auto" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapacityRefusal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InstallationLimit: Story = {};
export const PersonalLimit: Story = {
  args: { source: "own", admin: false, tries: 1 },
};
export const RoomAfterStop: Story = {
  args: {
    room: true,
    holders: [
      {
        agentId: "pi:synthetic",
        title: "Päivitä etusivu",
        workspaceName: "aurinkokello",
        activity: "turn",
        stopped: true,
      },
    ],
  },
};
