import type { Meta, StoryObj } from "@storybook/react";
import { AgentNoticeCard } from "./AgentNotice";

const meta = {
  title: "Conversation/Agent notice",
  component: AgentNoticeCard,
  args: {
    notice: {
      notice_id: "22222222-2222-4222-8222-222222222222",
      origin: "agent",
      timestamp: "2026-10-23T10:00:00Z",
      text: "Muista tarkistaa testit ennen seuraavaa julkaisua.",
      persistence: "persisted",
    },
  },
} satisfies Meta<typeof AgentNoticeCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Persisted: Story = {};
export const Temporary: Story = {
  args: { notice: { ...meta.args.notice, persistence: "not_persisted" } },
};
export const Unknown: Story = {
  args: { notice: { ...meta.args.notice, persistence: "unknown" } },
};
