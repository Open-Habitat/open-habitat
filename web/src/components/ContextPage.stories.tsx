import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContextPage } from "./ContextPage";
import { claudeAfterCompaction, piReading } from "./ContextPage.fixtures";

const codex = {
  window: 272000,
  autoCompaction: true,
  reserve: 16384,
  model: "GPT-5.5",
};

const meta = {
  title: "Production/Context page",
  component: ContextPage,
  args: {
    detail: { state: "ready", detail: piReading },
    usage: { phase: "known", tokens: 204220, ...codex },
    title: "Status script",
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Kontekstin erittely omana sivunaan (Sivu). Synteettiset luvut; kokonaismäärä on Pi:n mittaama, osat Pi:n merkkiarvioita.",
      },
    },
  },
} satisfies Meta<typeof ContextPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MidWork: Story = {};
export const ClaudeJustCompacted: Story = {
  args: {
    detail: { state: "ready", detail: claudeAfterCompaction },
    usage: {
      phase: "after",
      window: 1000000,
      autoCompaction: true,
      reserve: 16384,
      model: "Claude Opus 5.5",
    },
  },
};
export const WindowUnknown: Story = {
  args: { usage: { phase: "known", tokens: 204220, model: "fake-pi" } },
};
export const Loading: Story = { args: { detail: { state: "loading" } } };
export const Unavailable: Story = {
  args: { detail: { state: "unavailable" } },
};
