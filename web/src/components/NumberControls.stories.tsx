import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { NumberStepper } from "./NumberStepper";
import { formatDelay, recapDelayStops } from "./RecapSettings";
import { ScaleSlider } from "./ScaleSlider";

function Controls() {
  const [delay, setDelay] = useState(180);
  const [messages, setMessages] = useState(64);
  return (
    <div className="s-card" style={{ maxWidth: 760 }}>
      <div className="s-row">
        <div className="s-lbl">
          <strong>Hiljaisuus ennen katsausta</strong>
        </div>
        <ScaleSlider
          label="Hiljaisuus ennen katsausta"
          value={delay}
          stops={recapDelayStops}
          ticks={[60, 120, 180, 300, 540]}
          format={formatDelay}
          tickFormat={(s) => String(s / 60)}
          onChange={setDelay}
        />
      </div>
      <div className="s-row">
        <div className="s-lbl">
          <strong>Luettavat viestit</strong>
        </div>
        <NumberStepper
          label="Luettavat viestit"
          value={messages}
          min={4}
          max={128}
          step={4}
          unit="viestiä"
          onChange={setMessages}
        />
      </div>
    </div>
  );
}

const meta = {
  title: "Settings/Number controls",
  component: Controls,
} satisfies Meta<typeof Controls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
