import { type ReactNode, useEffect, useState } from "react";

export type CommandRunState =
  | "held"
  | "running"
  | "finished"
  | "cancelled"
  | "failed"
  | "not_started"
  | "uncertain";

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The same card frames live output and Pi's saved command entry.
 * Stop lives in the composer; this card only reports host state. */
export function CommandRun({
  command,
  excludeFromContext,
  state,
  exitCode,
  startedAt,
  output,
  stopping = false,
  children,
  label = "Sinä · komento",
}: {
  command: string;
  excludeFromContext: boolean;
  state: CommandRunState;
  exitCode?: number;
  startedAt?: number;
  output: string;
  stopping?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  const live = state === "running";
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live]);
  const status = stopping ? (
    <span className="ah-cmd-state">
      <span className="ah-command-spinner" aria-hidden="true" />
      Keskeytetään…
    </span>
  ) : state === "held" ? (
    <span className="ah-cmd-state">odottaa agentin käynnistymistä</span>
  ) : live ? (
    <span className="ah-cmd-state">
      <span className="ah-command-spinner" aria-hidden="true" />
      ajossa{" "}
      {startedAt !== undefined ? (
        <span className="ah-crow-clock">{mmss(now - startedAt)}</span>
      ) : null}
    </span>
  ) : state === "cancelled" ? (
    <span className="ah-cmd-state">pysäytetty</span>
  ) : state === "finished" && exitCode !== undefined ? (
    <span
      className={`ah-cmd-state ${exitCode === 0 ? "ah-cmd-state-ok" : "ah-cmd-state-err"}`}
    >
      paluuarvo {exitCode}
    </span>
  ) : state === "failed" ? (
    <span className="ah-cmd-state ah-cmd-state-err">epäonnistui</span>
  ) : state === "finished" ? (
    <span className="ah-cmd-state">valmis</span>
  ) : state === "not_started" ? (
    <span className="ah-cmd-state">ei ajettu</span>
  ) : (
    <span className="ah-cmd-state">tulos ei tiedossa</span>
  );
  const note =
    state === "not_started"
      ? "Komentoa ei ajettu. Sitä ei ajeta myöhemmin."
      : state === "uncertain"
        ? "Yhteys katkesi tai agentti päättyi ennen tulosta. Komentoa ei ajeta uudelleen."
        : undefined;
  return (
    <section className="ah-cmd-run" aria-label={label}>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="ah-crow-bang" aria-hidden="true">
            {excludeFromContext ? "!!" : "!"}
          </span>
          <code className="ah-cmd-command">{command}</code>
          {status}
        </summary>
        <div className="ah-cmd-body">
          {children ?? (
            <pre className="ah-cmd-out" aria-live="off">
              {output || (live ? "Odotetaan tulostetta…" : "(ei tulostetta)")}
            </pre>
          )}
          {note ? <p className="ah-cmd-note">{note}</p> : null}
        </div>
      </details>
    </section>
  );
}
