import { altKey } from "./altKey";
import type { AgentNavModel } from "./Navigation";
import "./NextWaitingRow.css";

// Seuraava odottava, direction Jono (Jari 30.10.2026,
// proto-next-waiting-navigation): once the host confirms that this
// conversation's agent works, the conversations waiting for the person are
// offered as one round in a slim line docked above the composer, outside the
// stream, so the streaming reply never moves it. An experimental feature: the
// caller renders it only when the person has turned it on.

export function NextWaitingRow({
  waiting,
  note,
  onStart,
}: {
  /** The others waiting for the person, in the rail's order; none hides the
   * line. */
  waiting: readonly AgentNavModel[];
  /** A one-off line above it, such as how the last round ended. */
  note?: string;
  onStart: () => void;
}) {
  if (!waiting.length && !note) return null;
  return (
    <div
      className={`ah-next-waiting${waiting.length ? "" : " quiet"}`}
      data-testid="next-waiting"
      data-waiting={waiting.length}
    >
      {note ? (
        <p className="ah-next-note" role="status" data-testid="next-note">
          {note}
        </p>
      ) : null}
      {waiting.length ? (
        <button
          type="button"
          className="ah-next-open"
          data-testid="next-open"
          aria-keyshortcuts="Alt+ArrowDown"
          title={`Käy läpi sinua odottavat (${altKey("↓")})`}
          onClick={onStart}
        >
          <span className="ah-next-label">Sillä aikaa</span>
          <span className="ah-next-ball" aria-hidden="true" />
          <span className="ah-next-title">{waiting.length} odottaa sinua</span>
          <span className="ah-next-det">
            {waiting.map((a) => a.title).join(", ")}
          </span>
          <span className="ah-next-go">
            Käy läpi <kbd>{altKey("↓")}</kbd>
          </span>
        </button>
      ) : null}
    </div>
  );
}
