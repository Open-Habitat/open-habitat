import { useEffect, useRef, useState } from "react";
import { type AgentNavModel, changeAge } from "./Navigation";
import "./NextWaitingRow.css";

// Seuraava odottava, direction Työssä (Jari 29.10.2026, research-workmux-sidebar
// round 3b): once the host confirms that this conversation's agent works,
// the next conversation waiting for the person is a slim line docked above
// the composer, outside the stream, so the streaming reply never moves it.
// It stays when the agent finishes. An experimental feature: the caller
// renders it only when the person has turned it on.

/** Why the offered conversation waits: a question or an unread reply. */
const why = (a: AgentNavModel) => (a.question ? "kysyy" : "uusi vastaus");

export function NextWaitingRow({
  offer,
  more,
  workspaceId,
  waits,
  now = Date.now(),
  onOpen,
}: {
  /** The next conversation waiting for the person; none hides the line. */
  offer?: AgentNavModel;
  /** How many others wait besides the offered one. */
  more: number;
  /** This conversation's workspace: another one's name is said. */
  workspaceId?: string;
  /** Whether a conversation still waits for the person. */
  waits: (agentId: string) => boolean;
  now?: number;
  onOpen: () => void;
}) {
  // The offered conversation handled on another device leaves Sinun vuorosi;
  // the offer moves on, and the line says so once. An offer that only moves
  // in the rail's order says nothing.
  const [note, setNote] = useState("");
  const shown = useRef(offer);
  const stillWaits = useRef(waits);
  stillWaits.current = waits;
  const offerId = offer?.agentId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the offer is read when its id changes.
  useEffect(() => {
    const before = shown.current;
    shown.current = offer;
    if (
      before &&
      before.agentId !== offerId &&
      !stillWaits.current(before.agentId)
    )
      setNote(`${before.title} hoidettiin toisaalla.`);
  }, [offerId]);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(""), 5000);
    return () => window.clearTimeout(timer);
  }, [note]);
  if (!offer && !note) return null;
  const detail = [
    offer?.workspaceId !== workspaceId ? offer?.workspaceName : undefined,
    offer ? why(offer) : undefined,
    offer?.changedAt !== undefined ? changeAge(offer.changedAt, now) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className={`ah-next-waiting${offer ? "" : " quiet"}`}
      data-testid="next-waiting"
      data-offer={offer?.agentId}
    >
      {note ? (
        <p className="ah-next-note" role="status" data-testid="next-note">
          {note}
        </p>
      ) : null}
      {offer ? (
        <button
          type="button"
          className="ah-next-open"
          data-testid="next-open"
          aria-keyshortcuts="Alt+ArrowDown"
          title={`Avaa ${offer.title} (Alt+↓)`}
          onClick={onOpen}
        >
          <span className="ah-next-label">Sillä aikaa</span>
          <span className="ah-next-ball" aria-hidden="true" />
          <span className="ah-next-title">{offer.title}</span>
          <span className="ah-next-det">{detail}</span>
          {more > 0 ? (
            <span
              className="ah-next-more"
              title={`${more} muuta odottaa sinua`}
            >
              +{more}
            </span>
          ) : null}
          <span className="ah-next-go">
            Avaa <kbd>Alt+↓</kbd>
          </span>
        </button>
      ) : null}
    </div>
  );
}
