import type { Meta, StoryObj } from "@storybook/react";
import { ConversationWeight } from "./ConversationWeight";

// The one size warning of a conversation (proto-large-content-graceful,
// direction C): near the advised size, and past it with the offer of a new
// conversation.
const MiB = 1024 * 1024;
const meta = {
  title: "Production/Conversation size",
  component: ConversationWeight,
  args: { agentId: "pi:story", bytes: 400 * MiB, onNewConversation: () => {} },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: "24px auto" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConversationWeight>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Said once as the conversation nears 512 MB; Selvä puts it away. */
export const Near: Story = {};
/** Past 512 MB: it opens from the newest messages, and a new one is offered. */
export const Heavy: Story = { args: { agentId: "pi:heavy", bytes: 530 * MiB } };
