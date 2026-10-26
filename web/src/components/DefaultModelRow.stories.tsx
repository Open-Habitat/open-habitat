import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Segmented } from "./ControlElements";
import { DefaultModelRow } from "./DefaultModelRow";
import { type ModelChoice, ModelPicker } from "./ModelPicker";

const models: ModelChoice[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
].map((m) => ({
  ...m,
  provider: "claude-bridge",
  thinking_levels: ["off", "low", "medium", "high"],
}));
const meta = {
  title: "Settings/Default model row",
  component: DefaultModelRow,
  args: {
    provider: "claude-bridge",
    model: "claude-sonnet-5",
    thinking: "medium",
    models,
    children: null,
  },
  render: function RowStory(args) {
    const [model, setModel] = useState(args.model ?? undefined);
    const [thinking, setThinking] = useState(args.thinking);
    return (
      <div className="s-card" style={{ maxWidth: 760, marginBottom: 520 }}>
        <DefaultModelRow {...args} model={model} thinking={thinking}>
          <Segmented
            label="Palveluntarjoaja"
            value="claude-bridge"
            options={[{ id: "claude-bridge", label: "Claude-tilaus" }]}
            onChange={() => {}}
          />
          <ModelPicker
            models={args.models ?? []}
            selected={model}
            thinking={thinking}
            onSelect={setModel}
            onThinking={setThinking}
          />
        </DefaultModelRow>
      </div>
    );
  },
} satisfies Meta<typeof DefaultModelRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const BrokenDefault: Story = {
  args: {
    models: models.map((m) =>
      m.id === "claude-sonnet-5"
        ? { ...m, outcome: "refused", observed_at: new Date().toISOString() }
        : m,
    ),
  },
};
export const NoDefault: Story = { args: { provider: null, model: null } };
