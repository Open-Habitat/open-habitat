import { type ReactNode, useEffect, useId, useState } from "react";
import { DisclosureButton } from "../ControlElements";
import { Icon } from "../Icon";
import { OutputBox } from "../OutputBox";
import { StatusMark } from "../Status";

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
  source = "live",
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
  source?: "live" | "history";
}) {
  const live = state === "running";
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live]);
  const outputId = useId();
  const failed =
    state === "failed" ||
    (state === "finished" && exitCode !== undefined && exitCode !== 0);
  const succeeded = state === "finished" && !failed;
  const statusLabel = stopping
    ? "Keskeytetään…"
    : state === "held"
      ? "Odottaa agentin käynnistymistä"
      : live
        ? `Ajossa${startedAt !== undefined ? ` ${mmss(now - startedAt)}` : ""}`
        : state === "cancelled"
          ? "Pysäytetty"
          : state === "finished"
            ? failed
              ? `Paluuarvo ${exitCode}`
              : "Valmis"
            : state === "failed"
              ? "Epäonnistui"
              : state === "not_started"
                ? "Ei ajettu"
                : "Tulos ei tiedossa";
  const note =
    state === "not_started"
      ? "Komentoa ei ajettu. Sitä ei ajeta myöhemmin."
      : state === "uncertain"
        ? "Yhteys katkesi tai agentti päättyi ennen tulosta. Komentoa ei ajeta uudelleen."
        : undefined;
  return (
    <section
      className="ah-cmd-run"
      aria-label={label}
      data-state={state}
      data-exit-code={exitCode}
      data-exclude-from-context={excludeFromContext}
      data-testid="command-run"
      data-source={source}
      data-stopping={stopping}
      data-excluded={excludeFromContext}
    >
      <DisclosureButton
        tool
        data-testid="command-run-toggle"
        aria-expanded={open}
        aria-controls={outputId}
        onPress={() => setOpen(!open)}
      >
        <Icon
          name="forward"
          className={open ? "ah-icon-expanded" : undefined}
        />
        <span className="ah-crow-bang" aria-hidden="true">
          {excludeFromContext ? "!!" : "!"}
        </span>
        <code className="ah-cmd-command">{command}</code>
        <StatusMark
          label={statusLabel}
          kind={failed ? "error" : succeeded ? "success" : "neutral"}
          tone={failed ? "danger" : "neutral"}
          animated={live || stopping ? "running" : false}
        />
      </DisclosureButton>
      <div id={outputId} className="ah-cmd-body ah-bash-card" hidden={!open}>
        {children ?? (
          <OutputBox
            text={
              output || (live ? "Odotetaan tulostetta…" : "(ei tulostetta)")
            }
            running={live}
          />
        )}
        {note ? <p className="ah-cmd-note">{note}</p> : null}
      </div>
    </section>
  );
}
