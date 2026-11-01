import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { AccountShelf } from "./Account";
import {
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "./Navigation";
import { QuietSection } from "./QuietSection";
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
              filterValue=""
              resultSummary="1 työtila"
              listState="ready"
              now={
                <NowSections
                  collapsed={collapsed}
                  yours={[
                    {
                      agentId: "pi:asks",
                      title: "Etusivun kuvagalleria",
                      href: "/agents/pi:asks",
                      activityLabel: "Kysyy sinulta",
                      controlLabel: "",
                      question: true,
                      workspaceName: "kotisivu",
                      detail: "kotisivu · Kysyy sinulta",
                    },
                    {
                      agentId: "pi:example",
                      title: "Lokakuun kuukausiraportti",
                      href: "/agents/pi:example",
                      activityLabel: "Uusi vastaus",
                      controlLabel: "",
                      attentionLabel: "Uusi",
                      workspaceName: "budjetti-2027",
                      detail: "budjetti-2027 · Uusi vastaus",
                    },
                  ]}
                  quiet={
                    <QuietSection
                      choice={{ sort: "newest", workspace: null }}
                      rows={[
                        {
                          agentId: "pi:quiet",
                          title: "Kirjaston aukioloajat",
                          href: "/agents/pi:quiet",
                          activity: "closed",
                          activityLabel: "Valmis",
                          controlLabel: "",
                          workspaceId: "ws_kirjasto",
                          workspaceName: "kirjasto-api",
                          changedAt: Date.now() - 86400000,
                        },
                        {
                          agentId: "pi:older",
                          title: "Vanhempi avoin keskustelu",
                          href: "/agents/pi:older",
                          activity: "closed",
                          activityLabel: "Valmis",
                          controlLabel: "",
                          workspaceId: "ws_kotisivu",
                          workspaceName: "kotisivu",
                          changedAt: Date.now() - 7 * 86400000,
                          selected: true,
                        },
                      ]}
                    />
                  }
                  running={[
                    {
                      agentId: "pi:waits",
                      title: "Lainojen eräpäivämuistutus",
                      href: "/agents/pi:waits",
                      activity: "waiting_background",
                      activityLabel: "Odottaa taustatyötä",
                      controlLabel: "",
                      spinoffWorking: true,
                      workspaceName: "kirjasto-api",
                      detail:
                        "kirjasto-api · Odottaa taustatyötä · Muistutusten sähköpostipohja",
                    },
                    {
                      agentId: "pi:working",
                      title: "Laskutusnäkymän taulukko",
                      href: "/agents/pi:working",
                      activity: "working",
                      activityLabel: "Työskentelee",
                      controlLabel: "",
                      workspaceName: "asiakasportaali",
                      detail: "asiakasportaali · Työskentelee",
                    },
                  ]}
                />
              }
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
              <WorkspaceNavRow
                name="esimerkki"
                href="/workspaces/ws_example00"
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
