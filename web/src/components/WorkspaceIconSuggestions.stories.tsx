import type { Meta, StoryObj } from "@storybook/react-vite";
import type { WorkspaceIconModel } from "./WorkspaceIcon";
import {
  type IconSuggestionItem,
  WorkspaceIconSuggestions,
} from "./WorkspaceIconSuggestions";

// The suggestion row under the workspace page's heading (workspace-icons,
// experimental; Sirut): the model's icons with reasons, a wish, quick wishes
// and rounds; without a model, the chain's own choices.
const meta = {
  title: "Production/Workspace icon suggestions",
  component: WorkspaceIconSuggestions,
  parameters: { layout: "padded" },
} satisfies Meta<typeof WorkspaceIconSuggestions>;
export default meta;
type Story = StoryObj<typeof meta>;

const base: WorkspaceIconModel = {
  name: "open-habitat",
  glyph: { letters: "OH", hue: 0 },
  show: { kind: "glyph" },
  source: "Kirjaintunnus · johdettu nimestä",
};
const item = (
  value: string,
  why: string,
  local = false,
): IconSuggestionItem => ({
  value,
  why,
  local,
  icon: value === "OH" ? base : { ...base, show: { kind: "emoji", value } },
});
const intents = {
  onAccept: () => {},
  onAsk: () => {},
  onRound: () => {},
  onDismiss: () => {},
  onOpenSettings: () => {},
};
const seen =
  "nimi, README:n alku, aloitussivu, kielet (Go 58 %, TypeScript 36 %, Shell 4 %), logon polku";

export const Suggestions: Story = {
  args: {
    model: {
      status: "done",
      items: [
        item("🪺", "pesä agenteille"),
        item("🏡", "habitat, asuinsija"),
        item("🐚", "kuori eli shell"),
        item("🦦", "pitää kotinsa järjestyksessä"),
        item("OH", "nimikirjaimet"),
      ],
      reply:
        "README:n mukaan Open Habitat on selainkoti natiiveille agenteille.",
      wishing: false,
      startedAt: 0,
      round: { at: 1, count: 2 },
      seen,
      model: "anthropic/claude-sonnet-5-5",
    },
    ...intents,
  },
};

export const Loading: Story = {
  args: {
    model: {
      status: "loading",
      wishing: false,
      startedAt: Date.now(),
      round: { at: -1, count: 0 },
      seen,
    },
    ...intents,
  },
};

export const NoModel: Story = {
  args: {
    model: {
      status: "failed",
      reason: "model_unavailable",
      items: [
        item("OH", "nimestä", true),
        item("🦊", "nimestä arvottu", true),
        item("🧭", "nimestä arvottu", true),
        item("🪐", "nimestä arvottu", true),
      ],
      wishing: false,
      startedAt: 0,
      round: { at: -1, count: 0 },
      seen: "nimi",
    },
    ...intents,
  },
};
