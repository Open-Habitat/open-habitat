import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AccountSettings, AccountShelf } from "./Account";
import {
  AgentHeader,
  AppShell,
  WorkspaceRail,
  WorkspaceSection,
} from "./Navigation";
import { Button } from "./Primitives";
import { ConnectionBanner, type ConnectionState } from "./Status";
import { WorkingProgress } from "./WorkingProgress";

const noop = () => {};
const meta = {
  title: "Production/Journey states",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Journey({
  narrow = false,
  listState = "ready",
  connection = "online",
  collapsedInitially = false,
}: {
  narrow?: boolean;
  listState?:
    | "ready"
    | "loading"
    | "empty"
    | "filtered-empty"
    | "source-absent"
    | "error"
    | "stale";
  connection?: ConnectionState;
  collapsedInitially?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(collapsedInitially);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState("");
  const [details, setDetails] = useState(false);
  return (
    <div style={narrow ? { maxWidth: 390 } : undefined}>
      <AppShell
        connection={
          <ConnectionBanner
            state={connection}
            lastConfirmedAt="10.42"
            onRetry={noop}
          />
        }
        rail={
          <WorkspaceRail
            collapsed={collapsed}
            serverLabel="Esimerkkipalvelin"
            connectionLabel={
              connection === "online" ? "Yhteys toimii" : "Tieto vanhentunut"
            }
            filterValue={filter}
            resultSummary={
              listState === "ready"
                ? "1 työtila, 1 keskustelu"
                : "Työtiloja ei voitu vahvistaa"
            }
            listState={listState}
            onToggle={() => setCollapsed(!collapsed)}
            onFilter={setFilter}
            onRefresh={noop}
            sessionActions={
              <AccountShelf name="Oma tili" onSettings={noop} onLogout={noop} />
            }
          >
            <WorkspaceSection
              workspaceId="w-1"
              name="esimerkki-työtila"
              href="/workspaces/w-1"
              expanded={expanded}
              selected
              summary="Git-työtila"
              onToggle={() => setExpanded(!expanded)}
              actions={[{ label: "Avaa työtila", onPress: noop }]}
              agents={[
                {
                  agentId: "a-1",
                  href: "/workspaces/w-1/agents/a-1",
                  title:
                    "Tarkista todella pitkä keskustelun otsikko joka ei mahdu navigaation yhdelle riville",
                  activityLabel: "Työskentelee",
                  controlLabel: "Selain ohjaa",
                  selected: true,
                },
              ]}
            />
          </WorkspaceRail>
        }
        main={
          <>
            <h1 tabIndex={-1}>esimerkki-työtila</h1>
            <p>Valitse keskustelu tai palaa työtilaan.</p>
            <AgentHeader
              title="Tarkista todella pitkä keskustelun otsikko joka ei mahdu navigaation yhdelle riville"
              activityLabel="Työskentelee"
              controlLabel="Selain ohjaa"
              workspaceLabel="esimerkki-työtila"
              workspaceHref="/workspaces/w-1"
              detailsExpanded={details}
              onToggleDetails={() => setDetails(!details)}
            />
            <WorkingProgress
              state="accepted"
              events={[{ type: "tool_execution_start", toolName: "read" }]}
            />
          </>
        }
      />
    </div>
  );
}
export const WorkspaceLandingAndLongTitle: Story = {
  render: () => <Journey />,
};
export const ExpandedLongTitle: Story = {
  render: () => <Journey />,
  play: async ({ canvasElement }) => {
    const toggle =
      canvasElement.querySelector<HTMLButtonElement>(".ah-title-toggle");
    toggle?.click();
  },
};
export const SessionRevalidationMask: Story = {
  render: () => (
    <AppShell
      connection={<ConnectionBanner state="loading" />}
      main={
        <p>Istuntoa tarkistetaan. Henkilökohtainen sisältö ei ole näkyvissä.</p>
      }
    />
  ),
};
export const WorkspaceLandingNarrow: Story = {
  render: () => <Journey narrow collapsedInitially />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const ExpandedRailNarrow: Story = {
  render: () => <Journey narrow />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const EmptyWorkspaces: Story = {
  render: () => <Journey listState="empty" />,
};
export const MissingWorkspaceSource: Story = {
  render: () => <Journey listState="source-absent" />,
};
export const FilteredEmpty: Story = {
  render: () => <Journey listState="filtered-empty" />,
};
export const WorkspaceReadError: Story = {
  render: () => <Journey listState="error" connection="daemon-unavailable" />,
};
export const StaleOutageWithVerifiedContent: Story = {
  render: () => <Journey listState="stale" connection="stale" />,
};
export const StaleOutageNarrow: Story = {
  render: () => <Journey narrow listState="stale" connection="stale" />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const SessionExpiredNoOldContent: Story = {
  render: () => (
    <AppShell
      connection={<ConnectionBanner state="authentication-required" />}
      main={<p>Kirjaudu uudelleen nähdäksesi työtilat.</p>}
    />
  ),
};
export const AccountReturnFocus: Story = {
  render: () => (
    <AccountSettings name="Oma tili" nativeState="partial" onBack={noop} />
  ),
};
export const StoppingPi: Story = {
  render: () => (
    <main>
      <WorkingProgress state="stopping" events={[]} />
      <Button
        size="row"
        label="Keskeytä vuoro"
        availability={{
          state: "disabled",
          reason: "Keskeytyksen kuittausta odotetaan.",
        }}
        onPress={noop}
      />
    </main>
  ),
};
export const UncertainPi: Story = {
  render: () => (
    <main>
      <WorkingProgress state="uncertain" events={[]} />
    </main>
  ),
};
