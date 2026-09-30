import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AssistantMessage,
  EndedConversationControl,
  Composer,
  ConversationTimeline,
  UncertainCommandCard,
  UserMessage,
  SupportedQuestion,
} from "./Conversation";
import { Markdown } from "./Markdown";
import { WorkingProgress } from "./WorkingProgress";

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
        elapsed={72}
      />
      <Composer
        value="Tarkista vielä testit"
        activity="working"
        selectedWorkingMode="follow_up"
        queueSummary="Jonossa 1"
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
        onInterrupt={noop}
        onOpenQueue={noop}
      />
    </main>
  ),
};
export const StoppingTurn: Story = {
  render: () => (
    <main>
      <WorkingProgress state="stopping" events={[]} elapsed={91} />
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
// Both themes render the production continuation control, never a story-only copy.
export const EndedBrowserConversationLight: Story = {
  render: () => <EndedConversationControl state="ready" onContinue={noop} />,
  globals: { theme: "light" },
};
export const EndedBrowserConversationDark: Story = {
  render: () => <EndedConversationControl state="ready" onContinue={noop} />,
  globals: { theme: "dark" },
};
export const WriterConflict: Story = {
  render: () => (
    <EndedConversationControl state="writer_conflict" onContinue={noop} />
  ),
};
export const TerminalHistory: Story = {
  render: () => (
    <EndedConversationControl state="read_only_history" onContinue={noop} />
  ),
};
export const UnprovenControl: Story = {
  render: () => (
    <EndedConversationControl state="control_uncertain" onContinue={noop} />
  ),
};
export const UncertainContinuation: Story = {
  render: () => (
    <EndedConversationControl state="uncertain" onContinue={noop} />
  ),
};
// Every story uses the production components and the Storybook light/dark toolbar.
export const CompletedTurn: Story = {
  render: () => (
    <main>
      <UserMessage sourceText="Tutki muutos." onCopy={noop} />
      <AssistantMessage streamState="complete" time="13.53" onCopy={noop}>
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
