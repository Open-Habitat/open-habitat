import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { AccountShelf } from "./Account";
import { AppShell, WorkspaceRail, WorkspaceSection } from "./Navigation";

const noop = () => {};
const meta = {
  title: "Production/Sidebar v2",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function Example({
  theme,
  collapsed,
}: {
  theme: "light" | "dark";
  collapsed: boolean;
}) {
  return (
    <MemoryRouter initialEntries={["/workspaces"]}>
      <div data-theme={theme}>
        <AppShell
          main={<h1>Jatka siitä, mihin jäit</h1>}
          rail={
            <WorkspaceRail
              collapsed={collapsed}
              serverLabel="esimerkki.test"
              connectionLabel="Yhdistetty"
              connectionTone="success"
              homeCurrent
              runningCount={2}
              filterValue=""
              resultSummary="1 työtila"
              listState="ready"
              onToggle={noop}
              onFilter={noop}
              onRefresh={noop}
              sessionActions={
                <AccountShelf
                  name="Oma tili"
                  onSettings={noop}
                  onLogout={noop}
                />
              }
            >
              <WorkspaceSection
                workspaceId="ws_example00"
                name="esimerkki"
                href="/workspaces/ws_example00"
                expanded
                onToggle={noop}
                agents={[
                  {
                    agentId: "pi:example",
                    title: "Keskustelu",
                    href: "/agents/pi:example",
                    activityLabel: "Työskentelee",
                    controlLabel: "Selainohjaus",
                  },
                ]}
              />
            </WorkspaceRail>
          }
        />
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
export const CollapsedLight: Story = {
  render: () => <Example theme="light" collapsed />,
};
export const CollapsedDark: Story = {
  render: () => <Example theme="dark" collapsed />,
};
