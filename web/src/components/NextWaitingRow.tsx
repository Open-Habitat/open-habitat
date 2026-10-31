import { useText } from "../i18n";
import { nextWaitingRowText } from "../text/nextWaitingRow";
import { altKey } from "./altKey";
import type { AgentNavModel } from "./Navigation";
import "./NextWaitingRow.css";

export function NextWaitingRow({
  waiting,
  onStart,
}: {
  /** The others waiting for the person, in the rail's order. */
  waiting: readonly AgentNavModel[];
  onStart: () => void;
}) {
  const txt = useText(nextWaitingRowText);
  if (!waiting.length) return null;
  return (
    <div
      className="ah-next-waiting"
      data-testid="next-waiting"
      data-waiting={waiting.length}
    >
      <button
        type="button"
        className="ah-next-open"
        data-testid="next-open"
        aria-keyshortcuts="Alt+ArrowDown"
        title={`${txt.go} (${altKey("↓")})`}
        onClick={onStart}
      >
        <span className="ah-next-label">{txt.meanwhile}</span>
        <span className="ah-next-ball" aria-hidden="true" />
        <span className="ah-next-title">{txt.waiting(waiting.length)}</span>
        <span className="ah-next-det">
          {waiting.map((a) => a.title).join(", ")}
        </span>
        <span className="ah-next-go">
          {txt.go} <kbd>{altKey("↓")}</kbd>
        </span>
      </button>
    </div>
  );
}
