import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StreamingActivityPreview } from "../test/StreamingActivityPreview";
import { MemoryRouter } from "react-router";
import { AgentTurn, ThinkingRow } from "./AgentTurn";
import { ArchiveControls } from "./ArchiveControls";
import { BashToolCard } from "./BashToolCard";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  HeldStartFailure,
  LiveToolRow,
  NativeQuestion,
  SendObservation,
  SupportedQuestion,
  UncertainCommandCard,
  UserMessage,
  WaitingMessage,
} from "./Conversation";
import { Markdown } from "./Markdown";
import { AgentHeader } from "./Navigation";
import { PiToolUse } from "./PiBlocks";
import { UnpresentedEvents, WorkingProgress } from "./WorkingProgress";
import { SkillInvocation } from "./SkillInvocation";

const noop = () => {};
const meta = { title: "Production/Conversation recovery" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const items = [
  {
    id: "u",
    content: (
      <UserMessage
        sourceText="Tarkista muutos."
        deliveryState="Hyväksytty"
        onCopy={noop}
      />
    ),
  },
  {
    id: "a",
    content: (
      <AssistantMessage streamState="interrupted" onCopy={noop}>
        <Markdown text="## Keskeytynyt\n\nTyö ei vahvistunut valmiiksi." />
      </AssistantMessage>
    ),
  },
];
function History({
  state,
  narrow = false,
}: {
  state: "empty" | "loading" | "error" | "stale" | "ready";
  narrow?: boolean;
}) {
  const [mode, setMode] = useState<"virtualized" | "pagedAccessible">(
    "virtualized",
  );
  return (
    <main style={narrow ? { maxWidth: 390 } : undefined}>
      <ConversationTimeline
        state={state}
        items={state === "stale" || state === "ready" ? items : []}
        historyMode={mode}
        onHistoryModeChange={setMode}
        onJumpToLatest={noop}
        problem={{
          title: "Historiaa ei saatu",
          description: "Yritä päivittää keskustelu.",
        }}
      />
    </main>
  );
}
const receiptStates = (
  ["pending", "accepted", "rejected", "uncertain"] as const
).map((state) => (
  <SendObservation
    key={state}
    text={`Testiviesti ${state}`}
    state={state}
    showText
    onCopy={noop}
  />
));
const receipts = (narrow = false) => (
  <main style={{ maxWidth: narrow ? 390 : 960 }}>
    {receiptStates}
    <NativeQuestion
      kind="unknown"
      prompt="<b>Ei HTML:ää</b>"
      choices={["Kyllä", "Ei"]}
      value=""
      state="open"
      onChange={noop}
      onRespond={noop}
    />
  </main>
);
export const TurnReceiptsLight: Story = {
  render: () => receipts(),
  globals: { theme: "light" },
};
export const TurnReceiptsDark: Story = {
  render: () => receipts(),
  globals: { theme: "dark" },
};
export const TurnReceiptsPhoneLight: Story = {
  render: () => receipts(true),
  globals: { theme: "light" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const TurnReceiptsPhoneDark: Story = {
  render: () => receipts(true),
  globals: { theme: "dark" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
const dialogStates = (narrow = false) => (
  <main style={{ maxWidth: narrow ? 390 : 780, display: "grid", gap: 20 }}>
    <NativeQuestion
      kind="input"
      prompt="Mitä nimeä käytetään?"
      choices={[]}
      value="Ehdotus"
      state="open"
      onChange={noop}
      onRespond={noop}
    />
    <NativeQuestion
      kind="select"
      prompt="Valitse haara"
      choices={["main", "feature"]}
      value="main"
      state="open"
      onChange={noop}
      onRespond={noop}
    />
    <NativeQuestion
      kind="confirm"
      prompt="Jatketaanko?"
      choices={[]}
      value=""
      state="open"
      onChange={noop}
      onRespond={noop}
    />
    <NativeQuestion
      kind="unknown"
      prompt="Tuntematon pyyntö"
      choices={[]}
      value=""
      state="open"
      onChange={noop}
      onRespond={noop}
    />
    <NativeQuestion
      kind="input"
      prompt="Nimi"
      choices={[]}
      value=""
      state="uncertain"
      onChange={noop}
      onRespond={noop}
    />
  </main>
);
export const PiDialogsLight: Story = {
  render: () => dialogStates(),
  globals: { theme: "light" },
};
export const PiDialogsDark: Story = {
  render: () => dialogStates(),
  globals: { theme: "dark" },
};
export const PiDialogsPhoneLight: Story = {
  render: () => dialogStates(true),
  globals: { theme: "light" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const PiDialogsPhoneDark: Story = {
  render: () => dialogStates(true),
  globals: { theme: "dark" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const EmptyHistory: Story = { render: () => <History state="empty" /> };
export const LoadingHistory: Story = {
  render: () => <History state="loading" />,
};
export const FailedHistory: Story = { render: () => <History state="error" /> };
export const StaleHistoryRetainsVerifiedMessages: Story = {
  render: () => <History state="stale" />,
};
export const StaleHistoryNarrow: Story = {
  render: () => <History state="stale" narrow />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const InterruptedTurn: Story = {
  render: () => <History state="ready" />,
};
export const WorkingWithNativeProgress: Story = {
  render: () => (
    <main>
      <WorkingProgress
        state="accepted"
        events={[{ type: "tool_execution_start", toolName: "bash" }]}
      />
      <Composer
        value="Tarkista vielä testit"
        activity="working"
        selectedWorkingMode="follow_up"
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
        onInterrupt={noop}
      />
    </main>
  ),
};
export const StoppingTurn: Story = {
  render: () => (
    <main>
      <WorkingProgress state="stopping" events={[]} />
      <Composer
        value=""
        activity="settling"
        selectedWorkingMode="follow_up"
        availability={{
          state: "disabled",
          reason: "Keskeytyksen kuittausta odotetaan.",
        }}
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
      />
    </main>
  ),
};
export const RejectedDraftRetained: Story = {
  render: () => (
    <main>
      <Composer
        value="Tarkista viimeisin muutos."
        activity="idle"
        selectedWorkingMode="follow_up"
        sendState="rejected"
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
      />
    </main>
  ),
};
export const UncertainDraftAndReceipt: Story = {
  render: () => (
    <main>
      <Composer
        value="Tarkista viimeisin muutos."
        activity="idle"
        selectedWorkingMode="follow_up"
        sendState="uncertain"
        availability={{
          state: "disabled",
          reason: "Tarkista edellisen lähetyksen tila.",
        }}
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
      />
      <UncertainCommandCard
        commandLabel="Lähetä viesti"
        textPreview="Tarkista viimeisin muutos."
        commandIdLabel="cmd_demo_001"
        explanation="Kuittausta ei saatu. Viesti on voitu hyväksyä."
        availability={{ state: "enabled" }}
        onReconcile={noop}
        onCopyText={noop}
        onSendAsNew={noop}
      />
    </main>
  ),
};
export const UncertainDraftNarrow: Story = {
  ...UncertainDraftAndReceipt,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390 }}>
        <Story />
      </div>
    ),
  ],
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

// An interrupted observation blocks writes without taking focus from the draft.
const disconnectedComposer = () => (
  <Composer
    value="Keskeneräinen viesti"
    activity="idle"
    selectedWorkingMode="follow_up"
    availability={{ state: "unknown", reason: "Yhteyttä tarkistetaan." }}
    editorAvailability={{ state: "enabled" }}
    onChange={noop}
    onSendNow={noop}
    onSteer={noop}
    onFollowUp={noop}
    onModeChange={noop}
  />
);
export const InterruptedStreamLight: Story = {
  render: disconnectedComposer,
  globals: { theme: "light" },
};
export const InterruptedStreamDark: Story = {
  render: disconnectedComposer,
  globals: { theme: "dark" },
};
// Messages sent before Pi runs: the production waiting bubbles and the
// composer's Stop, in both themes (Kupla odottaa, Jari 16.10.2026).
const waitingForPi = () => (
  <main className="ah-conversation-frame" style={{ minHeight: 360 }}>
    <ol className="ah-feed">
      <li data-kind="user">
        <WaitingMessage
          text="Aja testit ja korjaa, mitä löytyy."
          state="waiting"
          onCopy={noop}
        />
      </li>
      <li data-kind="user">
        <WaitingMessage
          text="Lisää README:hen esimerkki."
          state="waiting"
          onCopy={noop}
        />
      </li>
    </ol>
    <Composer
      value=""
      activity="idle"
      selectedWorkingMode="follow_up"
      onChange={noop}
      onSendNow={noop}
      onSteer={noop}
      onFollowUp={noop}
      onModeChange={noop}
      onStopWaiting={noop}
    />
  </main>
);
export const WaitingForPiLight: Story = {
  render: waitingForPi,
  globals: { theme: "light" },
};
export const WaitingForPiDark: Story = {
  render: waitingForPi,
  globals: { theme: "dark" },
};
// The header, queue and footer use the same production components in both themes.
const v2Conversation = () => (
  <MemoryRouter>
    <main className="ah-conversation-frame" style={{ minHeight: 600 }}>
      <AgentHeader
        title="Tee etusivusta mobiiliystävällinen"
        activityLabel="Työskentelee"
        activityKind="working"
        activityAnimated
        controlKind="neutral"
        controlLabel="Selainohjaus"
        workspaceLabel="kotisivu"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded={false}
        onToggleDetails={noop}
      />
      <div className="ah-conversation-stream">
        <ConversationTimeline
          state="ready"
          items={[
            {
              id: "user",
              kind: "user",
              content: (
                <UserMessage
                  sourceText="Tee etusivusta mobiiliystävällinen."
                  onCopy={noop}
                />
              ),
            },
            {
              id: "assistant",
              kind: "assistant",
              content: (
                <AssistantMessage onCopy={noop}>
                  <Markdown text="Katson ensin, mitä työtilassa on." />
                </AssistantMessage>
              ),
            },
          ]}
          historyMode="virtualized"
          onJumpToLatest={noop}
        />
      </div>
      <Composer
        value=""
        activity="working"
        selectedWorkingMode="steer"
        queue={{
          steering: ["Älä muuta footerin rakennetta."],
          followUp: ["Aja lopuksi Lighthouse mobiiliprofiililla."],
        }}
        onRestoreQueue={noop}
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
        onInterrupt={noop}
      />
    </main>
  </MemoryRouter>
);
export const V2WorkingLight: Story = {
  render: v2Conversation,
  globals: { theme: "light" },
};
export const V2WorkingDark: Story = {
  render: v2Conversation,
  globals: { theme: "dark" },
};
export const PiStartFailed: Story = {
  render: () => (
    <main>
      <ol className="ah-feed">
        <li data-kind="user">
          <WaitingMessage
            text="Aja testit ja korjaa, mitä löytyy."
            state="failed"
            onCopy={noop}
          />
        </li>
      </ol>
      <HeldStartFailure count={1} onRetry={noop} onEdit={noop} />
    </main>
  ),
};
export const UncertainDelivery: Story = {
  render: () => (
    <ol className="ah-feed">
      <li data-kind="user">
        <WaitingMessage
          text="Viesti, jonka toimitusta daemonin uudelleenkäynnistys ei kertonut."
          state="uncertain"
          onCopy={noop}
        />
      </li>
    </ol>
  ),
};
// Every story uses the production components and the Storybook light/dark toolbar.
export const CompletedTurn: Story = {
  render: () => (
    <main>
      <UnpresentedEvents
        events={[
          { type: "entry_appended" },
          { type: "queue_update" },
          { type: "session_info_changed" },
          { type: "future_event", payload: "Never a conversation row" },
        ]}
      />
      <UserMessage sourceText="Tutki muutos." onCopy={noop} />
      <AssistantMessage
        streamState="complete"
        modelLabel="gpt-5-codex"
        time="13.53"
        onCopy={noop}
      >
        <Markdown text="Muutos tarkistettu." />
      </AssistantMessage>
    </main>
  ),
};
export const ReadOnlyHistory: Story = {
  render: () => (
    <main>
      <History state="ready" />
      <p role="status">
        Vain luku · Ohjaus ei ole käytettävissä. Historiaa voi lukea, mutta
        viestiä ei voi lähettää.
      </p>
    </main>
  ),
};
export const IncomingQuestion: Story = {
  render: () => (
    <main>
      <SupportedQuestion
        requestId="synthetic-question"
        kind="confirm"
        prompt="Jatketaanko tarkistusta?"
        state="open"
        onChange={noop}
        onRespond={noop}
        onCancel={noop}
      />
    </main>
  ),
};
export const AwayFromLatest: Story = {
  render: () => (
    <main>
      <ConversationTimeline
        state="ready"
        items={items}
        historyMode="pagedAccessible"
        showJumpToLatest
        onJumpToLatest={noop}
      />
    </main>
  ),
};

export const LiveToolLight: Story = {
  render: () => <LiveToolRow name="bash" state="running" />,
  globals: { theme: "light" },
};
export const LiveToolDark: Story = {
  render: () => <LiveToolRow name="bash" state="running" />,
  globals: { theme: "dark" },
};

export const ArchiveConfirmation: Story = {
  render: () => (
    <ArchiveControls
      state="active"
      eligible
      busy={false}
      onArchive={noop}
      onRestore={noop}
    />
  ),
};
export const ArchiveWriterConflict: Story = {
  render: () => (
    <ArchiveControls
      state="active"
      eligible={false}
      busy={false}
      onArchive={noop}
      onRestore={noop}
    />
  ),
};
export const ArchiveAnnotationUnavailable: Story = {
  render: () => (
    <ArchiveControls
      state="unknown"
      eligible={false}
      busy={false}
      onArchive={noop}
      onRestore={noop}
    />
  ),
};

export const SettledTurn: Story = {
  render: () => (
    <main style={{ maxWidth: 800, padding: 24 }}>
      <AgentTurn
        model="fake-pi"
        steps={[
          {
            kind: "thinking",
            key: "t",
            node: <ThinkingRow text="Tarkistin hakemiston" />,
          },
          {
            kind: "tool",
            key: "ls",
            target: "ls",
            node: (
              <PiToolUse name="bash" state="succeeded" targetText="ls">
                <BashToolCard command="ls" output="README.md" />
              </PiToolUse>
            ),
          },
          {
            kind: "text",
            key: "a",
            text: "Tässä on vastaus.",
            node: <Markdown text="Tässä on vastaus." />,
          },
        ]}
      />
    </main>
  ),
};

export const WorkingTurn: Story = {
  render: () => (
    <main style={{ maxWidth: 800, padding: 24 }}>
      <AgentTurn
        model="fake-pi"
        working
        activity="Ajaa bash"
        duration="0:05"
        steps={[
          {
            kind: "thinking",
            key: "t",
            node: <ThinkingRow text="**Tarkistan komennon**" live />,
          },
          {
            kind: "tool",
            key: "ls",
            target: "ls",
            node: (
              <PiToolUse name="bash" state="running" targetText="ls">
                <BashToolCard
                  command="ls"
                  output={Array.from(
                    { length: 53 },
                    (_, i) => `rivi ${i + 1}`,
                  ).join("\n")}
                  running
                />
              </PiToolUse>
            ),
          },
          {
            kind: "text",
            key: "a",
            text: "Tarkistan tulosta",
            node: <Markdown text="Tarkistan tulosta" />,
          },
        ]}
      />
    </main>
  ),
};

export const StreamingActivity: Story = {
  render: () => <StreamingActivityPreview />,
};

export const RecordedSkill: Story = {
  render: () => (
    <UserMessage
      sourceText="Tarkista myös mobiilinäkymä."
      onCopy={noop}
      skill={
        <SkillInvocation
          name="worktree"
          description="Router for the worktree family. Routes a request to the matching worktree skill."
        >
          <Markdown text={skillText} />
        </SkillInvocation>
      }
    />
  ),
};
export const RecordedSkillMissingDescription: Story = {
  render: () => (
    <UserMessage
      sourceText=""
      onCopy={noop}
      skill={
        <SkillInvocation
          name={`very-long-recorded-skill-${"name-".repeat(20)}`}
        >
          <Markdown text="# Ohje\n\n- Tarkista muutos." />
        </SkillInvocation>
      }
    />
  ),
};
const skillText =
  "# worktree\n\nThe user typed `/worktree` without saying which kind of worktree they want. Your job is to work that out from their words and invoke the matching sibling skill with the original request unchanged.\n\n## Reading the request\n\nRoute on what the user is asking for, not on a word appearing in the text.";
