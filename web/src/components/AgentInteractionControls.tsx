import { liveText } from "../i18n";
import { agentInteractionControlsText } from "../text/agentInteractionControls";
import { Button, TextArea } from "./Primitives";
import { InlineNotice } from "./Status";
import type { Availability } from "./types";

const txt = liveText(agentInteractionControlsText);

/** Presentation only: the caller owns acknowledgement, draft persistence and native control. */
export type SendResult =
  | "ready"
  | "pending"
  | "acknowledged"
  | "rejected"
  | "uncertain";
export type InterruptResult =
  | "ready"
  | "pending"
  | "acknowledged"
  | "rejected"
  | "uncertain";

const noHandler = (): Availability => ({
  state: "unsupported",
  reason: txt.noHandler,
});

export function AgentInteractionControls({
  draft,
  sendAvailability,
  sendResult,
  interruptAvailability,
  interruptResult = "ready",
  onDraftChange,
  onSend,
  onInterrupt,
}: {
  draft: string;
  sendAvailability: Availability;
  sendResult: SendResult;
  interruptAvailability: Availability;
  interruptResult?: InterruptResult;
  onDraftChange: (draft: string) => void;
  onSend?: () => void;
  onInterrupt?: () => void;
}) {
  // The draft stays editable even when transport/control is unavailable. Never
  // infer native availability from an existing history or a nonempty draft.
  const sendBlocked = sendResult === "pending" || sendResult === "uncertain";
  const sendControl: Availability = !onSend
    ? noHandler()
    : sendBlocked
      ? {
          state: "disabled",
          reason:
            sendResult === "pending"
              ? txt.sendPending
              : txt.sendUncertainReason,
        }
      : sendAvailability.state !== "enabled"
        ? sendAvailability
        : !draft.trim()
          ? { state: "disabled", reason: txt.writeFirst }
          : sendAvailability;
  const interruptControl: Availability = !onInterrupt
    ? noHandler()
    : interruptResult === "pending" || interruptResult === "uncertain"
      ? {
          state: "disabled",
          reason:
            interruptResult === "pending"
              ? txt.interruptPending
              : txt.interruptUncertainReason,
        }
      : interruptAvailability;

  const send = () => {
    if (sendControl.state === "enabled") onSend?.();
  };
  const interrupt = () => {
    if (interruptControl.state === "enabled") onInterrupt?.();
  };

  return (
    <section aria-label={txt.controls} className="ah-agent-controls">
      <div className="ah-composer-entry">
        <TextArea
          data-testid="composer-input"
          label={txt.message}
          value={draft}
          onChange={onDraftChange}
          rows={1}
          onCommit={sendControl.state === "enabled" ? send : undefined}
        />
        <Button
          data-testid="composer-send"
          size="page"
          label={txt.send}
          ariaLabel={txt.send}
          icon="up"
          availability={sendControl}
          pending={sendResult === "pending"}
          onPress={send}
        />
      </div>
      <div className="ah-actions">
        <Button
          data-testid="agent-interrupt"
          size="row"
          label={txt.interrupt}
          variant="secondary"
          availability={interruptControl}
          pending={interruptResult === "pending"}
          onPress={interrupt}
        />
      </div>
      <div role="status" aria-live="polite">
        {sendResult === "pending" ? <p>{txt.messagePending}</p> : null}
        {sendResult === "acknowledged" ? <p>{txt.messageAccepted}</p> : null}
        {sendResult === "rejected" ? (
          <InlineNotice
            title={txt.rejectedTitle}
            description={txt.rejectedDetail}
            tone="danger"
          />
        ) : null}
        {sendResult === "uncertain" ? (
          <InlineNotice
            title={txt.uncertainTitle}
            description={txt.uncertainDetail}
            tone="warning"
          />
        ) : null}
        {interruptResult === "pending" ? <p>{txt.interruptWaiting}</p> : null}
        {interruptResult === "acknowledged" ? (
          <p>{txt.interruptAccepted}</p>
        ) : null}
        {interruptResult === "rejected" ? (
          <InlineNotice title={txt.interruptRejected} tone="danger" />
        ) : null}
        {interruptResult === "uncertain" ? (
          <InlineNotice
            title={txt.interruptUncertainTitle}
            description={txt.interruptUncertainDetail}
            tone="warning"
          />
        ) : null}
      </div>
    </section>
  );
}
