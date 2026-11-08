import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompactionNotice } from "./CompactionNotice";

const meta = {
  title: "Conversation/Compaction notice",
  component: CompactionNotice,
  args: { notice: { kind: "running" } },
} satisfies Meta<typeof CompactionNotice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compacting: Story = {};
export const Failed: Story = {
  args: { notice: { kind: "failed", reason: "compaction_failed" } },
};
export const NothingToCompact: Story = {
  args: { notice: { kind: "failed", reason: "nothing_to_compact" } },
};
