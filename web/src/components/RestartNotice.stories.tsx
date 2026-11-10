import type { Meta, StoryObj } from "@storybook/react";
import { RestartNoticeMarker } from "./RestartNotice";

const meta = {
  title: "Conversation/Restart notice",
  component: RestartNoticeMarker,
  args: {
    notice: {
      processes: [
        { process_id: "proc_8ffc", name: "wait-gate-evidence" },
        { process_id: "proc_57cf", name: "wait-pilot12b" },
      ],
      runs: [
        {
          run_id: "01m531x6y92ggdqcmb1exzmn00",
          title: "gate-lab-evidence-rewrite",
          state: "merged",
        },
        {
          run_id: "01m531x6y92ggdqcmb1exzmn01",
          title: "Julkaise pilot.12 ja päivitä testipalvelin",
          state: "stalled",
        },
      ],
      still_running: [],
    },
  },
} satisfies Meta<typeof RestartNoticeMarker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithNews: Story = {};
export const StillRunning: Story = {
  args: {
    notice: {
      processes: [],
      runs: [],
      still_running: [
        { run_id: "01m531x6y92ggdqcmb1exzmn02", title: "Julkaisu" },
      ],
    },
  },
};
