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
// Sinun vuorosi and Käynnissä narrowed each on its own: Sinun vuorosi to
// kotisivu, Käynnissä to a workspace with nothing running right now.
const listed = [
  { id: "ws_asiakas", name: "asiakasportaali" },
  { id: "ws_budjetti", name: "budjetti-2027" },
  { id: "ws_kirjasto", name: "kirjasto-api" },
  { id: "ws_kotisivu", name: "kotisivu" },
];
function Example({
  theme,
  collapsed,
  filtered = false,
}: {
  theme: "light" | "dark";
  collapsed: boolean;
  filtered?: boolean;
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
              adaptive={{
                places: [],
                search: {
                  label: "Search",
                  keyHint: "⌘K",
                  onOpen: () => undefined,
                },
                filter: false,
              }}
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
                  workspaces={listed}
                  yoursChoice={{
                    workspace: filtered ? "ws_kotisivu" : null,
                    onWorkspace: noop,
                  }}
                  runningChoice={{
                    workspace: filtered ? "ws_budjetti" : null,
                    onWorkspace: noop,
                  }}
                  yours={[
                    {
                      agentId: "pi:asks",
                      title: "Etusivun kuvagalleria",
                      href: "/agents/pi:asks",
                      activityLabel: "Kysyy sinulta",
                      controlLabel: "",
                      question: true,
                      workspaceId: "ws_kotisivu",
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
                      workspaceId: "ws_budjetti",
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
                      workspaceId: "ws_kirjasto",
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
                      workspaceId: "ws_asiakas",
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
export const FilteredLight: Story = {
  render: () => <Example theme="light" collapsed={false} filtered />,
};
export const FilteredDark: Story = {
  render: () => <Example theme="dark" collapsed={false} filtered />,
};
