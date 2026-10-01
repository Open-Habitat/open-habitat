import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { AccountSettings, AccountShelf } from "./Account";
import { AppShell, WorkspaceRail, WorkspaceSection } from "./Navigation";

const noop = () => {};
const meta = {
  title: "Production/Settings density v2",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Example({
  theme,
  view,
}: {
  theme: "light" | "dark";
  view: "settings" | "menu" | "drawer";
}) {
  return (
    <MemoryRouter initialEntries={["/workspaces"]}>
      <div data-theme={theme}>
        <AppShell
          main={
            view === "settings" ? (
              <AccountSettings name="Oma tili" onBack={noop} onLogout={noop} />
            ) : (
              <h1>Jatka siitä, mihin jäit</h1>
            )
          }
          rail={
            <WorkspaceRail
              collapsed={false}
              serverLabel="esimerkki.test"
              connectionLabel="Yhdistetty"
              connectionTone="success"
              homeCurrent
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
                    title: "Pitkä keskustelu, joka typistyy ahtaassa valikossa",
                    href: "/agents/pi:example",
                    activityLabel: "Prosessin tila ei tiedossa",
                    controlLabel: "Vain luku",
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
export const SettingsLight: Story = {
  render: () => <Example theme="light" view="settings" />,
};
export const SettingsDark: Story = {
  render: () => <Example theme="dark" view="settings" />,
};
export const MenuLight: Story = {
  render: () => <Example theme="light" view="menu" />,
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector<HTMLButtonElement>("[aria-label='Oma tili, Tilivalikko']")
      ?.click();
  },
};
export const MenuDark: Story = {
  render: () => <Example theme="dark" view="menu" />,
  play: MenuLight.play,
};
export const DrawerLight: Story = {
  render: () => <Example theme="light" view="drawer" />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector<HTMLButtonElement>("[aria-label='Avaa navigaatio']")
      ?.click();
  },
};
export const DrawerDark: Story = {
  render: () => <Example theme="dark" view="drawer" />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: DrawerLight.play,
};
