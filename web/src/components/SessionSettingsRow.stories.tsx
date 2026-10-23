import type { Meta, StoryObj } from "@storybook/react-vite";
import { SessionSettingsRow } from "./SessionSettingsRow";

const meta = {
  title: "Conversation/Native settings changes",
  component: SessionSettingsRow,
  args: {
    marker: {
      key: "model",
      oldModel: "claude-bridge/claude-opus-5-5",
      model: "claude-bridge/claude-fable-5-1",
    },
  },
} satisfies Meta<typeof SessionSettingsRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Model: Story = {};
export const Thinking: Story = {
  args: {
    marker: { key: "thinking", oldThinking: "medium", thinking: "high" },
  },
};
export const Compaction: Story = {
  args: { marker: { key: "compact", compact: "Aiempi työ tiivistetty." } },
};
