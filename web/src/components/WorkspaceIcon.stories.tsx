import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { type AgentNavModel, NowSections } from "./Navigation";
import type { WorkspaceIconModel } from "./WorkspaceIcon";

// Workspace icons (experimental): the rail's rows lead with the icon from
// the repository's .open-habitat.yaml, its logo or a name-derived glyph.
const meta = {
  title: "Production/Workspace icons",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#185e87"/><path d="M8 17l8-7 8 7v7H8z" fill="#fff"/></svg>')}`;
const icons: Record<string, WorkspaceIconModel> = {
  "open-habitat": {
    name: "open-habitat",
    glyph: { letters: "OH", hue: 0 },
    show: { kind: "emoji", value: "🤖" },
    source: "Repon asetus",
    where: ".open-habitat.yaml",
  },
  kotisivu: {
    name: "kotisivu",
    glyph: { letters: "KO", hue: 1 },
    show: { kind: "image", src: logo },
    source: "Repon logo",
    where: "public/favicon.svg",
  },
  "northwind-monorepo": {
    name: "northwind-monorepo",
    glyph: { letters: "3D", hue: 4 },
    show: { kind: "glyph" },
    source: "Kirjaintunnus · johdettu nimestä",
  },
};
const row = (
  id: string,
  workspace: string,
  title: string,
  over: Partial<AgentNavModel> = {},
): AgentNavModel => ({
  agentId: id,
  href: `/agents/${id}`,
  title,
  activity: "working",
  activityLabel: "Työskentelee",
  controlLabel: "",
  workspaceId: `ws_${workspace.replace(/\W/g, "")}000000`,
  workspaceName: workspace,
  workspaceIcon: icons[workspace],
  detail: `${workspace} · Työskentelee`,
  changedAt: Date.now() - 3 * 60000,
  ...over,
});
function Example({
  theme,
  collapsed,
}: {
  theme: "light" | "dark";
  collapsed: boolean;
}) {
  return (
    <MemoryRouter>
      <div data-theme={theme}>
        <nav
          className={collapsed ? "ah-rail ah-rail-collapsed" : "ah-rail"}
          style={{ width: collapsed ? 56 : 280, height: 360 }}
        >
          <div className="ah-rail-content">
            <NowSections
              collapsed={collapsed}
              yours={[
                row("y1", "open-habitat", "Ikoniprototyypin suunnat", {
                  attentionLabel: "Uusi vastaus",
                }),
              ]}
              running={[
                row("r1", "northwind-monorepo", "Opettajan näkymän käännökset"),
                row("r2", "kotisivu", "Etusivun mobiilinäkymä"),
                row("r3", "open-habitat", "Rail-ikonit"),
                row("r4", "open-habitat", "pilot.16 testipalvelimelle", {
                  activity: "waiting",
                  activityLabel: "Odottaa viestiä",
                }),
              ]}
              card={{ onNew: () => {} }}
            />
          </div>
        </nav>
      </div>
    </MemoryRouter>
  );
}
export const Light: Story = {
  render: () => <Example theme="light" collapsed={false} />,
};
export const Dark: Story = {
  render: () => <Example theme="dark" collapsed={false} />,
};
export const Strip: Story = {
  render: () => <Example theme="light" collapsed />,
};
