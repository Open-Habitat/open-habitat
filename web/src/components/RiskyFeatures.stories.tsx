import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  type RiskyAllowance,
  type RiskyFeatureId,
  riskyFeatureIds,
} from "../app/accountPreferences";
import { RiskyFeaturesControl } from "./RiskyFeatures";
import "./Settings.css";

const allowedAt: RiskyAllowance = { allowed_at: "2026-01-02T07:43:00Z" };

const meta = {
  title: "Production/Risky features",
  component: RiskyFeaturesControl,
  args: {
    features: riskyFeatureIds,
    allowed: (_id: RiskyFeatureId): RiskyAllowance | undefined => undefined,
    disabled: false,
    onChange: () => {},
    onReload: () => {},
  },
  render: function Example(args) {
    const [on, setOn] = useState<
      Partial<Record<RiskyFeatureId, RiskyAllowance | null>>
    >({});
    return (
      <section className="s-main">
        <h2>Vaaralliset toiminnot</h2>
        <RiskyFeaturesControl
          {...args}
          allowed={(id) =>
            on[id] === undefined ? args.allowed(id) : (on[id] ?? undefined)
          }
          onChange={(id, value) =>
            setOn((s) => ({ ...s, [id]: value ? allowedAt : null }))
          }
        />
      </section>
    );
  },
} satisfies Meta<typeof RiskyFeaturesControl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = {};
export const Allowed: Story = { args: { allowed: () => allowedAt } };
export const Saving: Story = {
  args: { disabled: true, busy: "conversation-links" },
};
export const SaveFailed: Story = { args: { error: "conversation-links" } };
export const ReadFailed: Story = { args: { error: "read" } };
