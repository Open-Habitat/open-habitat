import { Icon } from "./Icon";
import type { BallKind } from "./Navigation";
import "./NextWaitingRow.css";

// Seuraava odottava, direction Jono (Jari 30.10.2026,
// proto-next-waiting-navigation): while a round is on, the whole round is a
// bar above the composer: the origin, then the waiting ones in the rail's
// order. The bar is the visible way back (Alt+↑ and its button), it stays
// while a conversation asks something, and on the phone it shrinks to
// ‹ ●●○○ 1/3 · name · Seuraava ✕, so the round can be walked by tapping.

/** One step of the round as the bar shows it. */
export type QueueStep = {
  agentId: string;
  title: string;
  /** The origin, still waiting, handled here or handled elsewhere. */
  state: "origin" | "waits" | "handled" | "elsewhere";
  /** The rail's ball for the step's live state. */
  ball: BallKind;
  /** Why it waits (kysyy, uusi vastaus) or the origin's state. */
  detail?: string;
};

export function NextWaitingQueue({
  steps,
  pos,
  note,
  onGo,
  onPrev,
  onNext,
  onEnd,
}: {
  steps: readonly QueueStep[];
  /** The step the person is on. */
  pos: number;
  note?: string;
  onGo: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
}) {
  const last = !steps
    .slice(pos + 1)
    .some((s) => s.state !== "elsewhere" && s.state !== "origin");
  const done = steps.filter(
    (s) => s.state === "handled" || s.state === "elsewhere",
  ).length;
  const current = steps[pos];
  return (
    <div className="ah-next-waiting" data-testid="next-waiting">
      {note ? (
        <p className="ah-next-note" role="status" data-testid="next-note">
          {note}
        </p>
      ) : null}
      <nav
        className="ah-next-queue"
        aria-label="Odottavat keskustelut"
        data-testid="next-queue"
        data-pos={pos}
      >
        <span className="ah-next-q-head">
          {done}/{steps.length - 1} hoidettu
        </span>
        <button
          type="button"
          className="ah-next-q-move prev"
          data-testid="next-queue-prev"
          aria-keyshortcuts="Alt+ArrowUp"
          aria-label="Edellinen"
          title="Edellinen (Alt+↑)"
          disabled={pos === 0}
          onClick={onPrev}
        >
          <Icon name="up" width={14} height={14} />
          <kbd>Alt+↑</kbd>
        </button>
        <ol>
          {steps.map((s, i) => (
            <li key={s.agentId} className={i === pos ? "on" : undefined}>
              <button
                type="button"
                className={`ah-next-q-step ${s.state}`}
                data-testid="next-queue-step"
                data-agent={s.agentId}
                data-state={s.state}
                aria-current={i === pos ? "step" : undefined}
                title={s.title}
                onClick={() => onGo(i)}
              >
                {s.state === "handled" ? (
                  <Icon name="check" className="ah-next-q-check" />
                ) : (
                  <span
                    className={`ah-next-q-ball ah-next-q-ball-${s.ball}`}
                    aria-hidden="true"
                  />
                )}
                <span className="ah-next-q-title">{s.title}</span>
                {s.detail ? (
                  <span className="ah-next-q-detail">{s.detail}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
        <span className="ah-next-q-compact" aria-hidden="true">
          <span className="ah-next-q-pips">
            {steps.map((s, i) => (
              <span
                key={s.agentId}
                className={`ah-next-q-pip${
                  i === pos
                    ? " on"
                    : s.state === "handled" || s.state === "elsewhere"
                      ? " ok"
                      : ""
                }`}
              />
            ))}
          </span>
          <span className="ah-next-q-cur">
            {pos === 0 ? "Lähtö" : `${pos}/${steps.length - 1}`} ·{" "}
            {current?.title}
          </span>
        </span>
        <button
          type="button"
          className="ah-next-q-move next"
          data-testid="next-queue-next"
          data-last={last || undefined}
          aria-keyshortcuts="Alt+ArrowDown"
          title={last ? "Takaisin lähtöön (Alt+↓)" : "Seuraava (Alt+↓)"}
          onClick={onNext}
        >
          {last ? "Lähtöön" : "Seuraava"} <kbd>Alt+↓</kbd>
        </button>
        <button
          type="button"
          className="ah-next-q-end"
          data-testid="next-queue-end"
          aria-label="Lopeta kierros"
          title="Lopeta kierros (Esc)"
          onClick={onEnd}
        >
          <Icon name="cross" width={14} height={14} />
        </button>
      </nav>
    </div>
  );
}
