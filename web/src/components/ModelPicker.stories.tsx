import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ComposerModelPicker } from "./ComposerModelPicker";
import { ControlButton, Segmented } from "./ControlElements";
import { ModelChip } from "./ModelChip";
import { type ModelChoice, ModelPicker } from "./ModelPicker";

const models: ModelChoice[] = [
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  { id: "claude-fable-5-2", name: "Claude Fable 5.2 1M" },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1 1M", older: true },
  { id: "claude-opus-4-1", name: "Claude Opus 4.1", older: true },
].map((m) => ({
  ...m,
  provider: "claude-bridge",
  thinking_levels: ["off", "low", "medium", "high"],
}));
const meta = {
  title: "Conversation/Model picker",
  component: ModelPicker,
  args: {
    models,
    selected: "claude-opus-5-5",
    thinking: "medium",
    onSelect: () => {},
    onThinking: () => {},
  },
} satisfies Meta<typeof ModelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compact: Story = {};
export const RecentRefusal: Story = {
  args: {
    models: models.map((m) =>
      m.id === "claude-opus-5-5"
        ? { ...m, outcome: "refused", observed_at: new Date().toISOString() }
        : m,
    ),
  },
};
export const Composer: Story = {
  render: function PickerStory(args) {
    const [selected, setSelected] = useState(args.selected);
    const [thinking, setThinking] = useState(args.thinking);
    return (
      <div
        className="ah-crow"
        style={{ paddingTop: 480, justifyContent: "flex-end" }}
      >
        <ModelChip
          model={`claude-bridge/${selected}`}
          thinking={thinking}
          models={models}
        />
        <ComposerModelPicker
          model={`claude-bridge/${selected}`}
          thinking={thinking}
          models={models}
        >
          {(close) => (
            <>
              <Segmented
                label="Palveluntarjoaja"
                value="claude-bridge"
                options={[{ id: "claude-bridge", label: "Claude-tilaus" }]}
                onChange={() => {}}
              />
              <ModelPicker
                {...args}
                selected={selected}
                thinking={thinking}
                onSelect={setSelected}
                onThinking={setThinking}
              />
              <div className="md-picker-actions">
                <a href="/settings/ai#default-model">Muuta oletusmallia</a>
                <ControlButton variant="primary" size="page" onPress={close}>
                  Valitse
                </ControlButton>
              </div>
            </>
          )}
        </ComposerModelPicker>
      </div>
    );
  },
};
