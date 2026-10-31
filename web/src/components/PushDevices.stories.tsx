import type { Meta, StoryObj } from "@storybook/react-vite";
import { PushDevices } from "./PushDevices";
import "./Settings.css";

const devices = [
  {
    device_id: "pd_aaaaaaaaaaaaaaaaaaaaaa",
    label: "iPhone · Safari",
    created_at: "2026-10-31T09:00:00Z",
    failed: false,
  },
  {
    device_id: "pd_bbbbbbbbbbbbbbbbbbbbbb",
    label: "Mac · Chrome",
    created_at: "2026-10-30T15:00:00Z",
    failed: true,
  },
];

const meta = {
  title: "Production/Push devices",
  component: PushDevices,
  args: {
    devices,
    thisDevice: "pd_aaaaaaaaaaaaaaaaaaaaaa",
    here: "ready",
    onEnable: () => {},
    onTest: () => {},
    onRemove: () => {},
    onReload: () => {},
  },
} satisfies Meta<typeof PushDevices>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ThisDeviceSubscribed: Story = {};
export const NoDevices: Story = {
  args: { devices: [], thisDevice: undefined },
};
export const IPhoneInSafari: Story = {
  args: { here: "home-screen", thisDevice: undefined },
};
export const Unreachable: Story = {
  args: { note: { kind: "outcome", outcome: "unreachable" } },
};
