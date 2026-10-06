import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { AccountShelf } from "./Account";
import { AppShell, WorkspaceRail, WorkspaceSection } from "./Navigation";
import { ReturnView } from "./ReturnView";

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
          mobileTitle="Etusivu"
          main={
            <ReturnView
              conversations={[
                {
                  id: "waiting",
                  href: "/agents/pi:example",
                  title: "Keskustelu odottaa vastausta",
                  workspace: "esimerkki",
                  browserSession: true,
                  process: "daemon_managed_live",
                  pendingQuestion: true,
                  attention: "new",
                },
                {
                  id: "working",
                  href: "/agents/pi:working",
                  title: "Käynnissä oleva keskustelu",
                  workspace: "esimerkki",
                  browserSession: true,
                  process: "daemon_managed_live",
                  command: "accepted",
                },
                {
                  id: "history",
                  href: "/agents/pi:history",
                  title: "Terminaalissa avattu keskustelu",
                  workspace: "esimerkki",
                  browserSession: false,
                  process: "not_observed",
                },
              ]}
            />
          }
          rail={
            <WorkspaceRail
              collapsed={collapsed}
              serverLabel="esimerkki.test"
              connectionLabel="Yhdistetty"
              connectionTone="success"
              homeCurrent
              runningCount={1}
              attentionCount={1}
              filterValue=""
              resultSummary="1 työtila"
              listState="ready"
              onToggle={noop}
              onFilter={noop}
              onRefresh={noop}
              sessionActions={
                <AccountShelf
                  name="Alice Example"
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
                    title: "Keskustelu odottaa vastausta",
                    href: "/agents/pi:example",
                    activityLabel: "Odottaa",
                    controlLabel: "",
                    attentionLabel: "Uusi",
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
