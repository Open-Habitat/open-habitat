import { Button, TextArea } from "./Primitives";
import { InlineNotice } from "./Status";
import type { Availability } from "./types";

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

const noHandler: Availability = {
  state: "unsupported",
  reason: "Ohjausta ei ole kytketty agenttiin.",
};

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
    ? noHandler
    : sendBlocked
      ? {
          state: "disabled",
          reason:
            sendResult === "pending"
              ? "Lähetyksen kuittausta odotetaan."
              : "Edellisen lähetyksen tulos on epävarma. Tarkista tila ennen uutta lähetystä.",
        }
      : sendAvailability.state !== "enabled"
        ? sendAvailability
        : !draft.trim()
          ? { state: "disabled", reason: "Kirjoita viesti ennen lähetystä." }
          : sendAvailability;
  const interruptControl: Availability = !onInterrupt
    ? noHandler
    : interruptResult === "pending" || interruptResult === "uncertain"
      ? {
          state: "disabled",
          reason:
            interruptResult === "pending"
              ? "Keskeytyksen kuittausta odotetaan."
              : "Keskeytyksen tulos on epävarma. Tarkista tila ennen uutta yritystä.",
        }
      : interruptAvailability;

  const send = () => {
    if (sendControl.state === "enabled") onSend?.();
  };
  const interrupt = () => {
    if (interruptControl.state === "enabled") onInterrupt?.();
  };

  return (
    <section aria-label="Agentin ohjaus" className="ah-agent-controls">
      <div className="ah-composer-entry">
        <TextArea
          label="Viesti agentille"
          value={draft}
          onChange={onDraftChange}
          rows={1}
          onCommit={sendControl.state === "enabled" ? send : undefined}
        />
        <Button
          size="page"
          label="Lähetä"
          ariaLabel="Lähetä"
          icon="up"
          availability={sendControl}
          pending={sendResult === "pending"}
          onPress={send}
        />
      </div>
      <div className="ah-actions">
        <Button
          size="row"
          label="Keskeytä vuoro"
          variant="secondary"
          availability={interruptControl}
          pending={interruptResult === "pending"}
          onPress={interrupt}
        />
      </div>
      <div role="status" aria-live="polite">
        {sendResult === "pending" ? (
          <p>Viesti odottaa kuittausta. Älä lähetä uudelleen.</p>
        ) : null}
        {sendResult === "acknowledged" ? (
          <p>Viesti hyväksyttiin. Tämä ei vahvista sen suorittamista.</p>
        ) : null}
        {sendResult === "rejected" ? (
          <InlineNotice
            title="Viesti hylättiin"
            description="Luonnos säilyy. Korjaa syy ja lähetä uudelleen vain tarkoituksella."
            tone="danger"
          />
        ) : null}
        {sendResult === "uncertain" ? (
          <InlineNotice
            title="Lähetyksen tulos on epävarma"
            description="Viesti on voitu hyväksyä. Tarkista tila; tätä viestiä ei lähetetä automaattisesti uudelleen. Luonnos säilyy."
            tone="warning"
          />
        ) : null}
        {interruptResult === "pending" ? (
          <p>Keskeytys odottaa kuittausta.</p>
        ) : null}
        {interruptResult === "acknowledged" ? (
          <p>
            Keskeytyspyyntö hyväksyttiin. Vuoron päättymistä ei ole vahvistettu.
          </p>
        ) : null}
        {interruptResult === "rejected" ? (
          <InlineNotice title="Keskeytys hylättiin" tone="danger" />
        ) : null}
        {interruptResult === "uncertain" ? (
          <InlineNotice
            title="Keskeytyksen tulos on epävarma"
            description="Tarkista tila ennen uutta yritystä."
            tone="warning"
          />
        ) : null}
      </div>
    </section>
  );
}
