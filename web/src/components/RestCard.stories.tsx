import type { Meta, StoryObj } from "@storybook/react";
import { RestCard } from "./RestartNotice";

// Synthetic data from the Kortti round (proto-wake-stopped-agent, wake-2).
const meta = {
  title: "Conversation/Rest card",
  component: RestCard,
  args: {
    stop: { cause: "idle", at: "2026-10-26T18:20:00Z" },
    wake: "asleep",
    notice: {
      processes: [],
      runs: [
        {
          run_id: "01m531x6y92ggdqcmb1exzmn00",
          title: "Kontrastikorjaukset",
          state: "merged",
          summary:
            "Korjasi 14 kontrastivirhettä hakusivulla ja lainausnäkymässä. axe-tarkistus on puhdas.",
          ended_at: "2026-10-26T18:12:00Z",
        },
        {
          run_id: "01m531x6y92ggdqcmb1exzmn01",
          title: "Sivutuksen testit",
          state: "failed",
          summary:
            "tests/sivutus.spec.ts:88 aikakatkaistiin: testi odottaa sivunvaihtoa, jota uudet hakusuodattimet eivät enää tee.",
          ended_at: "2026-10-26T18:31:00Z",
        },
        {
          run_id: "01m531x6y92ggdqcmb1exzmn02",
          title: "Lainaushistorian CSV-vienti",
          state: "not_merged",
          summary:
            "Vienti on valmis, mutta yhdistäminen törmäsi src/vienti/csv.ts:n muutokseen.",
          ended_at: "2026-10-26T18:41:00Z",
          branch: "wt/d0x-lainaushistoria-csv",
        },
      ],
      still_running: [
        {
          run_id: "01m531x6y92ggdqcmb1exzmn03",
          title: "Hakuindeksin uudelleenrakennus",
          created_at: "2026-10-26T17:47:00Z",
          waited: false,
        },
      ],
    },
  },
} satisfies Meta<typeof RestCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Asleep: Story = {};
export const Waking: Story = { args: { wake: "waking" } };
export const Awake: Story = { args: { wake: "awake" } };
export const AfterRestart: Story = {
  args: {
    stop: { cause: "restart", at: "2026-10-27T03:12:00Z" },
    notice: { processes: [], runs: [], still_running: [] },
  },
};
export const InHistory: Story = {
  args: { wake: undefined, wokeAt: "2026-10-27T04:21:00Z" },
};
export const WokenByHabitat: Story = {
  args: {
    stop: { cause: "crash", at: "2026-10-28T19:26:55Z" },
    wake: undefined,
    wokeAt: "2026-10-28T19:55:00Z",
    notice: {
      woke: "settled",
      processes: [{ process_id: "proc_8ffc", name: "wait-gate-health" }],
      runs: [
        {
          run_id: "01m531x6y92ggdqcmb1exzmn00",
          title: "gate-health-flakes",
          state: "merged",
          summary: "Korjasi kaksi epävakaata testiä.",
          ended_at: "2026-10-28T19:54:00Z",
        },
      ],
      still_running: [],
    },
  },
};
