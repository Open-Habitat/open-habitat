import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ModelField } from "./ModelField";
import { type ModelChoice, ModelPicker } from "./ModelPicker";
import {
  RecapSettings,
  type RecapSettingsValue,
  recapLevels,
} from "./RecapSettings";

const models: ModelChoice[] = [
  { id: "claude-fable-5-2", name: "Fable 5.2" },
  { id: "claude-opus-5-5", name: "Opus 5.5" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5" },
].map((m) => ({ ...m, provider: "claude-bridge" }));

function Section({ initial }: { initial: RecapSettingsValue }) {
  const [value, setValue] = useState(initial);
  const chosen = value.model?.split("/")[1];
  return (
    <div style={{ maxWidth: 760, marginBottom: 520 }}>
      <RecapSettings
        value={value}
        onChange={setValue}
        modelField={
          <ModelField
            rowId="recap-model"
            testId="recap-model"
            label="Malli"
            description="Fablea ja Opusta ei käytetä taustatöihin."
            provider="claude-bridge"
            model={chosen ?? "claude-sonnet-5-5"}
            auto={!chosen}
            models={models}
          >
            {(close) => (
              <ModelPicker
                models={models}
                selected={chosen}
                unavailable={(m) =>
                  /fable|opus/.test(m.id) ? "Ei taustatöihin" : undefined
                }
                auto={{
                  detail: "Nyt Sonnet 5.5",
                  selected: !chosen,
                  onSelect: () => {
                    setValue({ ...value, model: null });
                    close();
                  },
                }}
                onSelect={(id) => {
                  setValue({ ...value, model: `claude-bridge/${id}` });
                  close();
                }}
              />
            )}
          </ModelField>
        }
      />
    </div>
  );
}

const meta = {
  title: "Settings/Tilannekatsaus",
  component: Section,
  args: {
    initial: {
      level: "standard",
      delay_seconds: 180,
      model: null,
      ...recapLevels.standard,
    },
  },
} satisfies Meta<typeof Section>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Standard: Story = {};
export const Custom: Story = {
  args: {
    initial: {
      level: "custom",
      delay_seconds: 75,
      model: "claude-bridge/claude-haiku-5-5",
      ...recapLevels.short,
      response_tokens: 128,
    },
  },
};
