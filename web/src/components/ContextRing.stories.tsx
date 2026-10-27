import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContextRing, type ContextUsage } from "./ContextRing";

const codex = {
  window: 272000,
  autoCompaction: true,
  reserve: 16384,
  model: "GPT-5.5",
};
const states: [string, ContextUsage][] = [
  ["Alussa", { phase: "known", tokens: 11800, ...codex }],
  ["Keskellä", { phase: "known", tokens: 92400, ...codex }],
  ["Lähellä rajaa", { phase: "known", tokens: 205300, ...codex }],
  ["Rajalla", { phase: "known", tokens: 249600, ...codex }],
  ["Tiivistää", { phase: "compacting", tokens: 257100, ...codex }],
  ["Juuri tiivistetty", { phase: "after", ...codex }],
  [
    "1M-ikkuna",
    {
      phase: "known",
      tokens: 412000,
      window: 1000000,
      autoCompaction: true,
      reserve: 16384,
      model: "Claude Opus 5.5",
    },
  ],
  ["Ikkuna ei tiedossa", { phase: "known", tokens: 92400, model: "fake-pi" }],
  [
    "Automaattinen tiivistys pois",
    { phase: "known", tokens: 249600, ...codex, autoCompaction: false },
  ],
];

function States() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      {states.map(([label, usage]) => (
        <div
          key={label}
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <span style={{ width: "14rem" }}>{label}</span>
          <ContextRing usage={usage} />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Production/Context ring",
  component: ContextRing,
  args: { usage: states[2][1] },
  parameters: {
    docs: {
      description: {
        component:
          "Kontekstin käyttö yläpalkissa (Rengas). Synteettiset luvut; rajat ovat Pi:n omat (70 % ja 90 %, tiivistys ikkunan miinus varan kohdalla). Painike avaa kontekstin erittelysivun.",
      },
    },
  },
} satisfies Meta<typeof ContextRing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};
export const AllStates: Story = { render: () => <States /> };
