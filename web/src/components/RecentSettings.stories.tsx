import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RecentSettingsRow } from "./RecentSettings";
import "./Settings.css";

const meta = {
  title: "Production/Recent conversations setting",
  component: RecentSettingsRow,
  args: {
    count: 5,
    disabled: false,
    error: false,
    onChange: () => {},
    onReload: () => {},
  },
  render: function Example(args) {
    const [count, setCount] = useState(args.count);
    return (
      <section className="s-main">
        <RecentSettingsRow {...args} count={count} onChange={setCount} />
      </section>
    );
  },
} satisfies Meta<typeof RecentSettingsRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Pending: Story = { args: { disabled: true } };
export const Unconfirmed: Story = { args: { error: true } };
