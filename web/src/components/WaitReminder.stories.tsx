import type { Meta, StoryObj } from "@storybook/react";
import { WaitReminderMarker } from "./WaitReminder";

const meta = {
  title: "Conversation/Wait reminder",
  component: WaitReminderMarker,
  args: {
    reminder: {
      runs: [
        { run_id: "01m531x6y92ggdqcmb1exzmn00", title: "worker-presentation" },
      ],
    },
  },
} satisfies Meta<typeof WaitReminderMarker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OneWorker: Story = {};
export const Several: Story = {
  args: {
    reminder: {
      runs: [
        { run_id: "01m531x6y92ggdqcmb1exzmn00", title: "CSV-vienti" },
        { run_id: "01m531x6y92ggdqcmb1exzmn01", title: "Julkaisu" },
      ],
      more: 3,
    },
  },
};
