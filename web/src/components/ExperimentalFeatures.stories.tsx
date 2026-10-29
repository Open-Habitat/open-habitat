import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ExperimentalFeaturesControl } from "./ExperimentalFeatures";
import "./Settings.css";

const meta = {
  title: "Production/Experimental features",
  component: ExperimentalFeaturesControl,
  args: {
    enabled: (_id: string): boolean => false,
    disabled: false,
    onChange: () => {},
    onReload: () => {},
  },
  render: function Example(args) {
    const [on, setOn] = useState<Record<string, boolean>>({});
    return (
      <section className="s-main">
        <h2>Kokeelliset ominaisuudet</h2>
        <ExperimentalFeaturesControl
          {...args}
          enabled={(id) => on[id] ?? args.enabled(id)}
          onChange={(id, value) => setOn((s) => ({ ...s, [id]: value }))}
        />
      </section>
    );
  },
} satisfies Meta<typeof ExperimentalFeaturesControl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = {};
export const On: Story = { args: { enabled: () => true } };
export const Saving: Story = {
  args: { disabled: true, busy: "terminal-watch" },
};
export const SaveFailed: Story = { args: { error: "worker-row-sentence" } };
export const ReadFailed: Story = { args: { error: "read" } };
