import type { Meta, StoryObj } from "@storybook/react-vite";
import { SessionSettingsRow } from "./SessionSettingsRow";

const meta = {
  title: "Conversation/Native settings changes",
  component: SessionSettingsRow,
  args: {
    marker: {
      key: "model",
      oldModel: "claude-bridge/claude-opus-5-5",
      model: "claude-bridge/claude-fable-5-2",
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
  args: {
    marker: {
      key: "compact",
      at: "2026-11-08T18:44:00Z",
      compact:
        "## Tavoite\nKorjata kirjautumisen virhe.\n\n## Tehty\n- Testit lisätty\n- Virhe paikannettu istunnon vanhenemiseen",
    },
  },
};
