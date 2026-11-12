import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConversationModelDetails } from "./ConversationModelDetails";
import type { ModelChoice } from "./ModelPicker";

const models: ModelChoice[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  { id: "claude-fable-5-2", name: "Claude Fable 5.2 1M" },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
].map((m) => ({
  ...m,
  provider: "claude-bridge",
  thinking_levels: ["off", "low", "medium", "high"],
}));
const meta = {
  title: "Conversation/Model details",
  component: ConversationModelDetails,
  args: { model: "claude-bridge/claude-opus-5-5", thinking: "medium", models },
} satisfies Meta<typeof ConversationModelDetails>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ranked: Story = {};
export const MissingCatalog: Story = { args: { models: [] } };
export const OpenAI: Story = {
  args: {
    model: "openai-codex/gpt-6.1-sol",
    thinking: "high",
    models: ["gpt-6-luna", "gpt-6-astra", "gpt-6.1-terra", "gpt-6.1-sol"].map(
      (id) => ({
        id,
        name: id.replace(/^gpt-/, "GPT-"),
        provider: "openai-codex",
        thinking_levels: ["low", "medium", "high", "xhigh"],
      }),
    ),
  },
};
/** A model the host does not know is named, never described by a guess. */
export const UnknownFamily: Story = {
  args: {
    model: "openai-codex/house-model",
    models: [
      { id: "house-model", name: "House model", provider: "openai-codex" },
    ],
  },
};
