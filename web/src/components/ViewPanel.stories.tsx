import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ViewOfferCard } from "./ViewOffer";
import { ViewPanel, ViewSplit } from "./ViewPanel";

// Synthetic agent content; in the product it comes from the view's own host.
const content = `data:text/html;charset=utf-8,${encodeURIComponent(
  "<!doctype html><meta charset=utf-8><body style='font-family:system-ui;padding:24px'><h1>Myynti kasvaa verkossa</h1><p>Jäädytetty 25.10.2026.</p><button onclick=\"this.textContent='Tilaukset'\">Eurot</button></body>",
)}`;

const view = {
  view_id: "vabcdefghijklmnopqrstuvwxyz",
  title: "Myyntiraportti.html",
  entry: "Myyntiraportti.html",
  files: 1,
  bytes: 24576,
  created_at: "2026-10-25T12:00:00Z",
};

function PanelExample({
  initiallyExpanded = false,
  src = content,
  failed = false,
}: {
  initiallyExpanded?: boolean;
  src?: string;
  failed?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [width, setWidth] = useState(560);
  return (
    <div style={{ height: 700, display: "flex" }}>
      <ViewSplit
        open={open}
        expanded={expanded}
        width={width}
        min={320}
        max={800}
        onResize={setWidth}
        onReset={() => setWidth(560)}
        onShowConversation={() => setExpanded(false)}
        panel={
          <ViewPanel
            title={view.title}
            src={src || undefined}
            failed={failed}
            expanded={expanded}
            onToggleExpanded={() => setExpanded(!expanded)}
            onOpenTab={() => {}}
            onClose={() => setOpen(false)}
          />
        }
      >
        <div
          style={{
            padding: 24,
            display: "grid",
            gap: 16,
            alignContent: "start",
          }}
        >
          <p>Lokakuun myynti oli 84 600 €. Kokosin luvut raporttiin.</p>
          <ViewOfferCard
            view={view}
            state={open ? "open" : "idle"}
            onOpen={() => setOpen(true)}
            onOpenTab={() => {}}
          />
        </div>
      </ViewSplit>
    </div>
  );
}

const meta = {
  title: "Production/View panel",
  component: ViewPanel,
  args: {
    title: view.title,
    expanded: false,
    onToggleExpanded: () => {},
    onOpenTab: () => {},
    onClose: () => {},
  },
  render: () => <PanelExample />,
} satisfies Meta<typeof ViewPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BesideConversation: Story = {};
export const FullWindow: Story = {
  render: () => <PanelExample initiallyExpanded />,
};
export const Opening: Story = { render: () => <PanelExample src="" /> };
export const Failed: Story = { render: () => <PanelExample failed /> };
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
