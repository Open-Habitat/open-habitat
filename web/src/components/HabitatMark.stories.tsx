import type { Meta, StoryObj } from "@storybook/react-vite";
import { HabitatMark, type MarkState, type SubMarkState } from "./HabitatMark";
import { type AgentNavModel, NowSections } from "./Navigation";
import type { WorkspaceIconModel } from "./WorkspaceIcon";

// The Open Habitat mark as the agent state indicator: every state, the
// sub-agent dots and figure, and the wide (B) and narrow (N2) rail.
const meta = {
  title: "Production/State mark",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const states: MarkState[] = [
  "idle",
  "thinking",
  "working",
  "waiting",
  "read",
  "background",
  "done",
  "error",
  "unknown",
  "awaited",
  "stopping",
  "loading",
];
const icon = (letters: string, hue: number): WorkspaceIconModel => ({
  name: letters,
  glyph: { letters, hue },
  show: { kind: "glyph" },
  source: "Kirjaintunnus",
});
const row = (
  id: string,
  title: string,
  over: Partial<AgentNavModel>,
): AgentNavModel => ({
  agentId: id,
  href: `/agents/${id}`,
  title,
  activity: "waiting",
  activityLabel: "Odottaa viestiä",
  controlLabel: "",
  workspaceId: `ws_${id}0000000`,
  workspaceName: "kasvimaa",
  workspaceIcon: icon(id.toUpperCase(), Number(id.slice(1)) % 8),
  detail: "kasvimaa",
  changedAt: Date.now() - 4 * 60000,
  ...over,
});
const yours = [
  row("y1", "Uusi vastaus", { attentionLabel: "Uusi vastaus" }),
  row("y2", "Luettu vastaus", { turnMark: "read" }),
  row("y3", "Epäonnistui", { failed: true }),
];
const running = [
  row("r1", "Työskentelee", { activity: "working" }),
  row("r2", "Odottaa taustatyötä", {
    activity: "waiting_background",
    spinoffWorking: true,
    spinoffCounts: { working: 2, idle: 1 },
  }),
  row("r3", "Viisi workeria", {
    activity: "working",
    spinoffWorking: true,
    spinoffCounts: { working: 4, idle: 1 },
  }),
  row("r4", "Tila ei tiedossa", { activity: "unknown" }),
  row("r5", "Valmis", { activity: "waiting" }),
];

function Example({ theme }: { theme: "light" | "dark" | "contrast" }) {
  const subs: SubMarkState[][] = [
    ["working"],
    ["working", "waiting"],
    ["working", "thinking", "error"],
    ["working", "working", "working", "waiting"],
  ];
  return (
    <div
      data-theme={theme}
      style={{
        display: "grid",
        gap: 24,
        padding: 24,
        background: "var(--ah-bg)",
        color: "var(--ah-ink)",
      }}
    >
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {states.map((state) => (
            <tr key={state}>
              <th style={{ textAlign: "left", paddingRight: 16 }}>
                <code>{state}</code>
              </th>
              {[14, 16, 20, 48].map((size) => (
                <td key={size} style={{ padding: 4 }}>
                  <HabitatMark state={state} size={size} />
                </td>
              ))}
              <td style={{ padding: 4 }}>
                <span
                  style={{
                    position: "relative",
                    display: "inline-grid",
                    placeItems: "center",
                    width: 40,
                    height: 40,
                  }}
                >
                  <HabitatMark
                    variant="ring"
                    state={state}
                    size={40}
                    className="ah-now-dot-ring"
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {subs.map((s) => (
          <span key={s.join()} style={{ display: "flex", gap: 8 }}>
            <HabitatMark state="working" size={20} subs={s} />
            <HabitatMark state="working" size={16} subs={s} />
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "start" }}>
        {[false, true].map((collapsed) => (
          <nav
            key={String(collapsed)}
            className={collapsed ? "ah-rail ah-rail-collapsed" : "ah-rail"}
            style={{ width: collapsed ? 56 : 296, height: 520 }}
          >
            <div className="ah-rail-content">
              <NowSections
                collapsed={collapsed}
                yours={yours}
                running={running}
                card={{ onNew: () => {} }}
              />
            </div>
          </nav>
        ))}
      </div>
    </div>
  );
}
export const Light: Story = { render: () => <Example theme="light" /> };
export const Dark: Story = { render: () => <Example theme="dark" /> };
export const Contrast: Story = { render: () => <Example theme="contrast" /> };
