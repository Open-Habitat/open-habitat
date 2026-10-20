import { useEffect, useState } from "react";
import { AgentTurn, ThinkingRow } from "../components/AgentTurn";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  DiffView,
  ToolRow,
  UncertainCommandCard,
  UserMessage,
} from "../components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../components/ConversationFrame";
import {
  AgentFacts,
  AgentHeader,
  AppShell,
  WorkspaceRail,
  WorkspaceSection,
} from "../components/Navigation";
import { OperationProgress } from "../components/Operations";
import { ConnectionBanner } from "../components/Status";

const noop = () => {};
function QuietTurnPreview() {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTicks((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div style={{ height: 550 }}>
      <ConversationFrame>
        <ConversationStream>
          <div style={{ minHeight: 700 }} aria-hidden="true" />
          <AgentTurn
            working
            activity={ticks % 2 ? "Ajaa bash" : "Ajattelee"}
            duration={`0:${String(ticks).padStart(2, "0")}`}
            steps={[
              {
                kind: "thinking",
                key: "t",
                node: <ThinkingRow text="Tarkistan tiedostoja" />,
              },
              {
                kind: "other",
                key: "1",
                node: <p>Synteettinen vaihe yksi</p>,
              },
              {
                kind: "other",
                key: "2",
                node: <p>Synteettinen vaihe kaksi</p>,
              },
              {
                kind: "text",
                key: "a",
                text: "Vastaus virtaa tänne.",
                node: <p>Vastaus virtaa tänne.</p>,
              },
            ]}
          />
        </ConversationStream>
      </ConversationFrame>
    </div>
  );
}
export default function CatalogPreview({
  scenario = "happy",
  toolLayout = false,
  quietTurn = false,
}: {
  scenario?: "happy" | "unhappy";
  toolLayout?: boolean;
  quietTurn?: boolean;
}) {
  if (quietTurn) return <QuietTurnPreview />;
  return <CatalogContents scenario={scenario} toolLayout={toolLayout} />;
}
function CatalogContents({
  scenario,
  toolLayout,
}: {
  scenario: "happy" | "unhappy";
  toolLayout: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [value, setValue] = useState(
    "Tarkista vielä saavutettavuus ja pitkät suomenkieliset arvot.",
  );
  const [expanded, setExpanded] = useState(true);
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="alder.example"
      connectionLabel={
        scenario === "unhappy" ? "Tieto vanhentunut" : "Yhteys toimii"
      }
      attentionCount={scenario === "unhappy" ? 2 : 0}
      filterValue={filter}
      resultSummary="2 agenttia"
      listState={scenario === "unhappy" ? "stale" : "ready"}
      onToggle={noop}
      onFilter={setFilter}
      onRefresh={noop}
    >
      <WorkspaceSection
        workspaceId="workspace-1"
        name="erittäin-pitkä-suomenkielinen-asiakasworkspace-joka-ei-saa-rikkoa-asettelua"
        href="/workspaces/workspace-1"
        expanded={expanded}
        summary="Git-workspace"
        agents={[
          {
            agentId: "agent-1",
            href: "/workspaces/workspace-1/agents/agent-1",
            title: "Rakenna saavutettava komponenttikirjasto",
            activityLabel:
              scenario === "unhappy" ? "Tila ei tiedossa" : "Työskentelee",
            controlLabel: scenario === "unhappy" ? "Vain luku" : "Selain ohjaa",
            attentionLabel:
              scenario === "unhappy" ? "Odottaa vastaustasi" : undefined,
            selected: true,
          },
          {
            agentId: "agent-2",
            href: "/workspaces/workspace-1/agents/agent-2",
            title: "Selvitä hyvin pitkän historian suorituskyky",
            activityLabel: "Ei käynnissä",
            controlLabel: "Vain luku",
            stale: scenario === "unhappy",
          },
        ]}
        onToggle={() => setExpanded(!expanded)}
      />
    </WorkspaceRail>
  );
  const items = [
    {
      id: "user",
      content: (
        <UserMessage
          sourceText="Näytä miten tuntematon tila ja pitkä sisältö toimivat ilman pelkkää värikoodausta."
          deliveryState="Hyväksytty"
          onCopy={noop}
        />
      ),
    },
    ...(toolLayout
      ? [
          {
            id: "tool-layout",
            content: (
              <ToolRow
                name="bash"
                targetText={`find /synthetic/${"long-path/".repeat(20)} -type f`}
                statusLabel="valmis"
                state="succeeded"
                expanded={false}
                onToggle={noop}
              />
            ),
          },
        ]
      : []),
    {
      id: "assistant",
      content: (
        <AssistantMessage
          streamState={scenario === "unhappy" ? "interrupted" : "complete"}
          modelLabel="Pi"
          onCopy={noop}
        >
          <p>
            Jokainen tila näkyy tekstinä, ja tekniset tunnisteet säilyvät
            muuttumattomina.
          </p>
          <DiffView
            pathLabel="web/src/components/components.css"
            unifiedText={
              "--- a/components.css\n+++ b/components.css\n-color: red;\n+color: var(--ah-err);"
            }
            parseState="ready"
            view="unifiedAccessible"
            onCopy={noop}
            onViewChange={noop}
          />
        </AssistantMessage>
      ),
    },
  ];
  return (
    <AppShell
      connection={
        <ConnectionBanner
          state={scenario === "unhappy" ? "stale" : "online"}
          lastConfirmedAt="10.42"
          onRetry={noop}
        />
      }
      rail={rail}
      toast={null}
      main={
        <>
          <AgentHeader
            title="Rakenna saavutettava komponenttikirjasto"
            titleState={
              scenario === "unhappy"
                ? "Otsikon tila ei tiedossa"
                : "Hostin otsikko"
            }
            activityLabel={
              scenario === "unhappy" ? "Tila ei tiedossa" : "Työskentelee"
            }
            activityAnimated={scenario === "happy"}
            controlLabel={scenario === "unhappy" ? "Vain luku" : "Selain ohjaa"}
            workspaceLabel="erittäin-pitkä-suomenkielinen-asiakasworkspace"
            workspaceHref="/workspaces/workspace-1"
            detailsExpanded
            onToggleDetails={noop}
            titleAction={{
              label: "Luo otsikko uudelleen",
              availability:
                scenario === "unhappy"
                  ? {
                      state: "unknown",
                      reason: "Capabilityä ei ole vahvistettu.",
                    }
                  : { state: "enabled" },
              onPress: noop,
            }}
          />
          <AgentFacts
            facts={[
              {
                label: "Historia",
                value: scenario === "unhappy" ? "Ei saatavilla" : "Saatavilla",
                state: scenario === "unhappy" ? "unavailable" : "confirmed",
              },
              {
                label: "Prosessi",
                value: scenario === "unhappy" ? "Ei tiedossa" : "running",
                state: scenario === "unhappy" ? "unknown" : "confirmed",
              },
            ]}
          />
          {scenario === "unhappy" ? (
            <>
              <UncertainCommandCard
                commandLabel="Lähetä viesti"
                textPreview="Tämä teksti säilyy, eikä sitä lähetetä automaattisesti uudelleen."
                commandIdLabel="cmd_01JARIKORRELAATIO"
                explanation="Hyväksyntää ei voitu vahvistaa yhteyskatkoksen jälkeen."
                availability={{ state: "enabled" }}
                onReconcile={noop}
                onCopyText={noop}
                onSendAsNew={noop}
              />
              <OperationProgress
                operationId="op_01PARTIAL"
                kindLabel="Workspacen poisto"
                state="partial"
                stages={[
                  {
                    id: "check",
                    label: "Ennakkotarkistus",
                    state: "succeeded",
                  },
                  {
                    id: "remove",
                    label: "Hakemiston poisto",
                    state: "unknown",
                    detail: "Vaikutusta ei voitu vahvistaa.",
                  },
                ]}
                effects={[
                  {
                    kindLabel: "Annotaatio",
                    stateLabel: "Poistettu",
                    description: "Näyttönimi poistui.",
                  },
                  {
                    kindLabel: "Hakemisto",
                    stateLabel: "Ei tiedossa",
                    description: "Tarkista tuoreesta havainnosta.",
                  },
                ]}
                onClose={noop}
              />
            </>
          ) : (
            <ConversationTimeline
              state="ready"
              items={items}
              historyMode="virtualized"
              newContentCount={2}
              onJumpToLatest={noop}
              onHistoryModeChange={noop}
            />
          )}
          <Composer
            value={value}
            availability={
              scenario === "unhappy"
                ? {
                    state: "read_only",
                    reason: "Vanhentuneeseen tilaan ei voi kirjoittaa.",
                  }
                : { state: "enabled" }
            }
            activity="working"
            selectedWorkingMode="steer"
            queue={{
              steering: ["Tarkista tila"],
              followUp: ["Kirjoita yhteenveto"],
            }}
            queueKnown={scenario !== "unhappy"}
            onRestoreQueue={noop}
            onChange={setValue}
            onSendNow={noop}
            onSteer={noop}
            onFollowUp={noop}
            onModeChange={noop}
            onInterrupt={scenario === "happy" ? noop : undefined}
          />
        </>
      }
    />
  );
}
