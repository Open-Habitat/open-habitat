import type { Meta, StoryObj } from "@storybook/react-vite";
import fixture from "../../../contracts/v1/examples/spinoffs.json";
import { parseSpinoffs, type Spinoff } from "../app/spinoffs";
import { SpinoffContext, SpinoffGroup, SpinoffReadOnly } from "./Spinoffs";

const meta = {
  title: "Production/Spinoffs",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const data = parseSpinoffs(fixture);
const states: Spinoff["state"][] = [
  "working",
  "waiting_parent",
  "merged",
  "unmerged",
  "unknown",
];
export const Thread: Story = {
  render: () => (
    <SpinoffContext.Provider value={{ data, open: () => {} }}>
      <SpinoffGroup
        runs={states.map((state, i) => ({
          ...data.runs[0],
          state,
          preserved: state === "unmerged",
          run_id: `${data.runs[0].run_id}-${i}`,
        }))}
      />
    </SpinoffContext.Provider>
  ),
};
export const ReadOnly: Story = {
  render: () => (
    <SpinoffReadOnly
      run={data.runs[0]}
      transcripts={data.transcripts}
      stale={false}
      onParent={() => {}}
    />
  ),
};
export const Unavailable: Story = {
  render: () => <SpinoffReadOnly transcripts={[]} stale onParent={() => {}} />,
};
