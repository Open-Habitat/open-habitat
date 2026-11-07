import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContextPage } from "./ContextPage";
import { claudeAfterCompaction, piReading } from "./ContextPage.fixtures";
import type { ContextUsage } from "./ContextRing";
import { type CompactionControl, ContextView } from "./ContextView";
import { FileLinkContext } from "./fileRefs";

const known: ContextUsage = {
  phase: "known",
  tokens: 204220,
  window: 272000,
  autoCompaction: true,
  reserve: 16384,
  model: "GPT-5.5",
};
const control = (over: Partial<CompactionControl> = {}): CompactionControl => ({
  offer: "ready",
  running: false,
  onCompact: () => {},
  ...over,
});

function Page({
  detail = piReading,
  usage = known,
  compaction = control(),
}: {
  detail?: typeof piReading;
  usage?: ContextUsage;
  compaction?: CompactionControl;
}) {
  return (
    <FileLinkContext.Provider value={{ open: () => {} }}>
      <div style={{ position: "relative", height: "100vh" }}>
        <ContextPage
          detail={{ state: "ready", detail }}
          usage={usage}
          title="Status script"
          onClose={() => {}}
          view={(d) => (
            <ContextView detail={d} usage={usage} compaction={compaction} />
          )}
        />
      </div>
    </FileLinkContext.Provider>
  );
}

const meta = {
  title: "Production/Context view",
  component: Page,
  parameters: {
    docs: {
      description: {
        component:
          "Kokeellinen kontekstinäkymä Konteksti-sivulla (kierros 3, suunta 2): luku, lista ja Tiivistä nyt ohjeella. Synteettiset luvut.",
      },
    },
  },
} satisfies Meta<typeof Page>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AgentWaits: Story = {};
export const AgentWorks: Story = {
  args: { compaction: control({ offer: "busy" }) },
};
export const Compacting: Story = {
  args: { compaction: control({ running: true }) },
};
export const JustCompacted: Story = {
  args: {
    detail: claudeAfterCompaction,
    usage: { ...known, phase: "after", tokens: undefined },
  },
};
export const PiRefused: Story = {
  args: { compaction: control({ outcome: { kind: "nothing_to_compact" } }) },
};
export const NotTheBrowsersConversation: Story = {
  args: { compaction: control({ offer: "none" }) },
};
