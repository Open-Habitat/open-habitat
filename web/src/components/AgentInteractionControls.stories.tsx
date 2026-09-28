import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AgentInteractionControls,
  type SendResult,
} from "./AgentInteractionControls";
import type { Availability } from "./types";

const meta = {
  title: "Production/Agent interaction preparation",
  parameters: {
    docs: {
      description: {
        component:
          "Vain tuotantokomponentin tilakuvia. Ei yhteyttä Pi:hin eikä toimivaa lähetystä; selaimen kytkentä kuuluu agenttiohjauksen integraatioon.",
      },
    },
  },
} satisfies Meta<typeof AgentInteractionControls>;
export default meta;
type Story = StoryObj<typeof meta>;

const ready: Availability = { state: "enabled" };
const unavailable: Availability = {
  state: "read_only",
  reason: "Historia on vain luettavissa. Agentin ohjaus ei ole käytettävissä.",
};

function StatePreview({
  state,
  availability = ready,
}: {
  state: SendResult;
  availability?: Availability;
}) {
  const [draft, setDraft] = useState("Tarkista viimeisin muutos.");
  return (
    <main>
      <h1>Agentin ohjaus · tilan esikatselu</h1>
      <p>Tämä on paikallinen tilan esikatselu, ei toimiva Pi-yhteys.</p>
      <AgentInteractionControls
        draft={draft}
        onDraftChange={setDraft}
        sendAvailability={availability}
        sendResult={state}
        interruptAvailability={availability}
        interruptResult={state}
      />
    </main>
  );
}
export const Ready: Story = { render: () => <StatePreview state="ready" /> };
export const Unavailable: Story = {
  render: () => <StatePreview state="ready" availability={unavailable} />,
};
export const Pending: Story = {
  render: () => <StatePreview state="pending" />,
};
export const Acknowledged: Story = {
  render: () => <StatePreview state="acknowledged" />,
};
export const Rejected: Story = {
  render: () => <StatePreview state="rejected" />,
};
export const Uncertain: Story = {
  render: () => <StatePreview state="uncertain" />,
};
