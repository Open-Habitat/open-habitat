import type { Meta, StoryObj } from "@storybook/react-vite";
import fixture from "../../../contracts/v1/examples/spinoffs.json";
import { parseSpinoffs } from "../app/spinoffs";
import { SpinoffReadOnly } from "./Spinoffs";

const meta = {
  title: "Production/Spinoffs",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const data = parseSpinoffs(fixture);
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
