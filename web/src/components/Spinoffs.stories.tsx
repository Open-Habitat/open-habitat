import type { Meta, StoryObj } from "@storybook/react-vite";
import fixture from "../../../contracts/v1/examples/spinoffs.json";
import { Entry } from "../app/HistoryView";
import { parseSpinoffs } from "../app/spinoffs";
import { WorkerView } from "./Spinoffs";

const meta = {
  title: "Production/Worker view",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const data = parseSpinoffs(fixture);
const place = {
  parentTitle: "Kellonäkymän kesäaika",
  workspaceLabel: "aurinkokello",
  workspaceHref: "/workspaces",
  onParent: () => {},
};
const items = data.transcripts[0].entries.map((entry) => ({
  id: entry.entry_key,
  kind: entry.kind,
  content: <Entry entry={entry} />,
}));
export const Landed: Story = {
  render: () => (
    <WorkerView
      {...place}
      run={data.runs[0]}
      transcript={data.transcripts[0]}
      items={items}
      stale={false}
    />
  ),
};
export const ClaudeBeforeHistory: Story = {
  render: () => (
    <WorkerView
      {...place}
      run={{ ...data.runs[0], state: "working", harness: "claude" }}
      transcript={{
        node_id: "n-0001",
        harness: "claude",
        availability: "unavailable",
        truncated: false,
        entries: [],
      }}
      items={[]}
      stale={false}
      terminal={<pre>● Luen ensin nykyiset testit.</pre>}
    />
  ),
};
export const Unavailable: Story = {
  render: () => <WorkerView {...place} items={[]} stale />,
};
