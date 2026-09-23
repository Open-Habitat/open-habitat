import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectionBanner } from "./ConnectionBanner";
const meta = {
  component: ConnectionBanner,
  title: "Foundation/ConnectionBanner",
  args: { state: "loading" },
} satisfies Meta<typeof ConnectionBanner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {};
export const AuthenticationRequired: Story = {
  args: { state: "authentication_required" },
};
export const DaemonUnavailable: Story = {
  args: { state: "daemon_unavailable" },
};
