import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { AgentNavModel } from "./Navigation";
import { NextWaitingQueue, type QueueStep } from "./NextWaitingQueue";
import { NextWaitingRow } from "./NextWaitingRow";

const waiting = (agentId: string, title: string): AgentNavModel => ({
  agentId,
  href: "#",
  title,
  activityLabel: "Uusi vastaus",
  controlLabel: "",
});

const round: QueueStep[] = [
  {
    agentId: "a",
    title: "Varmuuskopion ajastus",
    state: "handled",
    ball: "work",
  },
  {
    agentId: "b",
    title: "Tiedostopuun lajittelu",
    state: "waits",
    ball: "you",
    detail: "uusi vastaus",
  },
  {
    agentId: "c",
    title: "Laskun PDF-pohja",
    state: "elsewhere",
    ball: "done",
    detail: "toisaalla",
  },
];

/** The round's bar, walkable: Seuraava, Edellinen, the steps and ✕; after
 * the last step Valmis ends it there. */
function Walk({ steps, start }: { steps: QueueStep[]; start: number }) {
  const [pos, setPos] = useState<number | null>(start);
  if (pos === null)
    return (
      <NextWaitingRow
        waiting={steps.map((s) => waiting(s.agentId, s.title))}
        note="Kierros käyty: 2 hoidettu."
        onStart={() => setPos(0)}
      />
    );
  return (
    <NextWaitingQueue
      steps={steps}
      pos={pos}
      onGo={setPos}
      onPrev={() => setPos(Math.max(0, pos - 1))}
      onNext={() => setPos(pos + 1 >= steps.length ? null : pos + 1)}
      onEnd={() => setPos(null)}
    />
  );
}

const meta = {
  title: "Production/Next waiting round",
  component: Walk,
  args: { steps: round, start: 1 },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, margin: "40px auto" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Walk>;
export default meta;
type Story = StoryObj<typeof meta>;

/** In a step that waits: one handled here, one elsewhere after it. */
export const InRound: Story = {};
/** At the first step: nothing to go back to. */
export const AtFirst: Story = { args: { start: 0 } };
/** The line that starts a round. */
export const Offer: Story = {
  render: () => (
    <NextWaitingRow
      waiting={round.map((s) => waiting(s.agentId, s.title))}
      onStart={() => {}}
    />
  ),
};
