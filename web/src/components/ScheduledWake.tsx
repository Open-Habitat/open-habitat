import { type FormEvent, useId, useState } from "react";
import { useText } from "../i18n";
import { scheduledWakeText } from "../text/scheduledWake";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { localInput, wakeFull } from "./wakeTime";
import "./ScheduledWake.css";

/** Habitat's line on a scheduled wake, as the daemon projects it from the
 * native message's details (history.schema.json#/$defs/scheduledWake). */
export type WakeLine = {
  kind: "fired" | "cancelled";
  wakes: {
    at: string;
    note: string;
    set_at?: string;
    fired_at?: string;
    late_seconds?: number;
    moved_from?: string;
    reason?: "person" | "archived";
    cancelled_at?: string;
  }[];
};

/** A pending wake as the conversation shows it. */
export type PendingWakeModel = {
  id: string;
  /** Unix ms. */
  at: number;
  note: string;
};

const ms = (s?: string) => (s ? Date.parse(s) : Number.NaN);

/** The line Habitat, not the agent, writes when a wake fired or a
 * cancellation was told to the agent; the agent's own text stays out. A
 * fired wake reads as one sentence after the name, "Open Habitat herätti
 * agentin …", with the agent's note under it. */
export function WakeLineMarker({ line }: { line: WakeLine }) {
  const t = useText(scheduledWakeText);
  const first = line.wakes[0];
  return (
    <aside
      className="ah-wake-line"
      role="note"
      data-testid="wake-line"
      data-kind={line.kind}
      data-late={first?.late_seconds ? "" : undefined}
    >
      <Icon name="clock" className="ah-wake-icon" aria-hidden="true" />
      <span className="ah-wake-line-who">{t.habitat}</span>{" "}
      {line.kind === "fired" && first ? (
        <span>
          {first.late_seconds && first.fired_at
            ? t.firedLate(wakeFull(ms(first.at)), wakeFull(ms(first.fired_at)))
            : t.fired(
                wakeFull(ms(first.at)),
                first.set_at ? wakeFull(ms(first.set_at)) : "",
              )}
          {first.moved_from
            ? ` ${t.moved(wakeFull(ms(first.moved_from)), wakeFull(ms(first.at)))}`
            : null}
          <span className="ah-wake-note">{first.note}</span>
        </span>
      ) : (
        <span>
          {t.cancelled(line.wakes.length)}
          <ul>
            {line.wakes.map((w) => (
              <li key={`${w.at}:${w.note}`}>
                {t.cancelReason[w.reason ?? "person"](wakeFull(ms(w.at)))}
                <span className="ah-wake-note">{w.note}</span>
              </li>
            ))}
          </ul>
        </span>
      )}
    </aside>
  );
}

/** The pending wake pinned at the conversation's foot, with the person's
 * Muuta aikaa… and Peru herätys (round 1, direction 1 with the bar). The
 * component returns the person's intent; the app writes it. */
export function PendingWakeBar({
  wakes,
  busy = false,
  problem,
  now = Date.now(),
  onMove,
  onCancel,
}: {
  wakes: PendingWakeModel[];
  busy?: boolean;
  problem?: string;
  now?: number;
  onMove: (id: string, at: Date) => void;
  onCancel: (id: string) => void;
}) {
  const t = useText(scheduledWakeText);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [past, setPast] = useState(false);
  const inputId = useId();
  const next = wakes[0];
  if (!next) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const when = new Date(value);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setPast(true);
      return;
    }
    setEditing(false);
    onMove(next.id, when);
  };
  return (
    <aside
      className="ah-wake-bar"
      data-testid="wake-bar"
      aria-label={t.bar(wakeFull(next.at, now))}
    >
      <span className="ah-wake-what">
        <Icon name="clock" className="ah-wake-icon" aria-hidden="true" />
        <strong data-testid="wake-bar-time">
          {t.bar(wakeFull(next.at, now))}
        </strong>
        <span className="ah-wake-by">· {t.setByAgent}</span>
        {wakes.length > 1 ? (
          <span className="ah-wake-by">· {t.more(wakes.length - 1)}</span>
        ) : null}
      </span>
      <span className="ah-wake-note" data-testid="wake-bar-note">
        {next.note}
      </span>
      {editing ? (
        <form
          className="ah-wake-editor"
          data-testid="wake-editor"
          onSubmit={submit}
        >
          <label htmlFor={inputId}>{t.newTime}</label>
          <input
            id={inputId}
            type="datetime-local"
            data-testid="wake-input"
            value={value}
            aria-invalid={past || undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setPast(false);
            }}
          />
          <ControlButton
            type="submit"
            variant="primary"
            size="row"
            data-testid="wake-save"
          >
            {t.save}
          </ControlButton>
          <ControlButton
            variant="quiet"
            size="row"
            data-testid="wake-keep"
            onPress={() => setEditing(false)}
          >
            {t.keep}
          </ControlButton>
          {past ? (
            <p role="alert" className="ah-wake-problem">
              {t.pastTime}
            </p>
          ) : null}
        </form>
      ) : (
        <span className="ah-wake-actions">
          <ControlButton
            variant="secondary"
            size="inline"
            data-testid="wake-change"
            isDisabled={busy}
            onPress={() => {
              setValue(localInput(next.at));
              setPast(false);
              setEditing(true);
            }}
          >
            {t.change}
          </ControlButton>
          <ControlButton
            variant="quiet"
            size="inline"
            data-testid="wake-cancel"
            isDisabled={busy}
            onPress={() => onCancel(next.id)}
          >
            {t.cancel}
          </ControlButton>
        </span>
      )}
      {problem ? (
        <p role="alert" className="ah-wake-problem" data-testid="wake-problem">
          {problem}
        </p>
      ) : null}
    </aside>
  );
}

/** The wakes the archive window says it cancels: every pending wake with its
 * full time and the agent's note (round 2, direction 2 Ikkuna). */
export function WakeArchiveRows({ wakes }: { wakes: PendingWakeModel[] }) {
  const t = useText(scheduledWakeText);
  return (
    <>
      <p>{t.archiveLead(wakes.length)}</p>
      <ul className="ah-wake-archive-rows">
        {wakes.map((w) => (
          <li key={w.id} data-testid="wake-archive-row">
            <Icon name="clock" className="ah-wake-icon" aria-hidden="true" />
            <div>
              <strong>{wakeFull(w.at)}</strong>{" "}
              <span className="ah-wake-by">· {t.setByAgent}</span>
              <p className="ah-wake-note">{w.note}</p>
            </div>
          </li>
        ))}
      </ul>
      <p>{t.archiveRule}</p>
    </>
  );
}
