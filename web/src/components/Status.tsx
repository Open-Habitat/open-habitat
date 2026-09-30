import type { ReactNode } from "react";
import { Button } from "./Primitives";
import { Icon } from "./Icon";
import type { Action, ProblemView, Tone } from "./types";

export type StatusKind =
  | "working"
  | "read-only"
  | "success"
  | "error"
  | "unknown"
  | "pill"
  | "neutral";
export function StatusMark({
  label,
  tone = "neutral",
  animated = false,
  kind = "neutral",
}: {
  label: string;
  tone?: Tone;
  animated?: false | "running";
  kind?: StatusKind;
}) {
  return (
    <span className={`ah-status ah-tone-${tone} ah-status-${kind}`}>
      {kind === "success" || kind === "error" || kind === "unknown" ? (
        <Icon
          name={
            kind === "success"
              ? "check"
              : kind === "error"
                ? "cross"
                : "question"
          }
        />
      ) : (
        <span
          aria-hidden="true"
          className={
            animated === "running"
              ? "ah-status-dot ah-running"
              : "ah-status-dot"
          }
        />
      )}
      {label}
    </span>
  );
}
export function Badge({
  label,
  tone = "neutral",
  count,
}: {
  label: string;
  tone?: Tone;
  count?: number;
}) {
  return (
    <StatusMark
      kind="pill"
      label={count === undefined ? label : `${label} ${count}`}
      tone={tone}
    />
  );
}
export function ProgressIndicator({
  label,
  kind,
  value,
}: {
  label: string;
  kind: "indeterminate" | "determinate";
  value?: number;
}) {
  return (
    <div className="ah-progress">
      <span>{label}</span>
      <progress
        aria-label={label}
        max={100}
        value={kind === "determinate" ? value : undefined}
      />
    </div>
  );
}
function Problem({ problem }: { problem?: ProblemView }) {
  return problem ? (
    <div className="ah-problem">
      <strong>{problem.title}</strong>
      {problem.description ? <p>{problem.description}</p> : null}
      {problem.code ? <code>{problem.code}</code> : null}
      {problem.correlationId ? (
        <code className="ah-correlation">{problem.correlationId}</code>
      ) : null}
    </div>
  ) : null;
}
export function InlineNotice({
  title,
  description,
  tone = "info",
  problem,
  actions = [],
}: {
  title: string;
  description?: string;
  tone?: Tone;
  problem?: ProblemView;
  actions?: Action[];
}) {
  return (
    <aside className={`ah-notice ah-tone-${tone}`}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      <Problem problem={problem} />
      {actions.length ? (
        <div className="ah-actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              variant="secondary"
              availability={action.availability}
              onPress={action.onPress}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
export type ConnectionState =
  | "loading"
  | "online"
  | "reconnecting"
  | "stale"
  | "resnapshot-required"
  | "authentication-required"
  | "daemon-unavailable"
  | "host-read-only";
export function ConnectionBanner({
  state,
  lastConfirmedAt,
  hostWriteState = "writable",
  problem,
  onRetry,
}: {
  state: ConnectionState;
  lastConfirmedAt?: string;
  hostWriteState?: "writable" | "read_only";
  problem?: ProblemView;
  onRetry?: () => void;
}) {
  // Snapshot write_state describes workspace mutations, not conversation control.
  // It is not a connectivity failure and does not need a page-wide warning.
  if (state === "online") return null;
  const visibleState = state;
  const copy: Record<
    Exclude<ConnectionState, "online">,
    { title: string; detail: string; tone: Tone }
  > = {
    loading: {
      title: "Ladataan palvelimen tilaa",
      detail: "Haetaan tuoreita tietoja…",
      tone: "neutral",
    },
    reconnecting: {
      title: "Yhteys katkesi",
      detail:
        "Yritetään yhdistää uudelleen. Viimeisintä viestiä ei lähetetä toistamiseen.",
      tone: "warning",
    },
    stale: {
      title: "Näytettävä tieto on vanhentunut",
      detail: `Viimeksi tarkistettu ${lastConfirmedAt ?? "ei tiedossa"}. Uusia muutoksia ei voi tehdä ennen yhteyden palaamista.`,
      tone: "warning",
    },
    "resnapshot-required": {
      title: "Tiedot on tarkistettava uudelleen",
      detail:
        "Yhteys oli poikki liian pitkään, jotta päivityksiä voisi jatkaa suoraan.",
      tone: "warning",
    },
    "authentication-required": {
      title: "Istunto puuttuu tai on vanhentunut",
      detail: "Kirjaudu uudelleen jatkaaksesi.",
      tone: "danger",
    },
    "daemon-unavailable": {
      title: "Yhteyttä ei saatu",
      detail:
        "Tietoja ei voitu tarkistaa. Tämä ei tarkoita, että työsi olisi kadonnut.",
      tone: "danger",
    },
    "host-read-only": {
      title: "Työtiloja ei voi nyt muuttaa",
      detail: "Yhteys toimii, mutta työtilojen muokkaus ei ole käytettävissä.",
      tone: "warning",
    },
  };
  const value = copy[visibleState as Exclude<ConnectionState, "online">];
  const urgent =
    visibleState === "authentication-required" ||
    visibleState === "daemon-unavailable";
  return (
    <div
      className={`ah-connection ah-tone-${value.tone}`}
      role={urgent ? "alert" : "status"}
    >
      <strong>{value.title}</strong>
      <span>
        {value.detail}
        {hostWriteState === "read_only" && visibleState !== "host-read-only"
          ? " Työtilojen muokkaus ei myöskään ole käytettävissä."
          : ""}
      </span>
      <Problem problem={problem} />
      {onRetry ? (
        <Button
          label="Yritä uudelleen"
          variant="secondary"
          size="compact"
          onPress={onRetry}
        />
      ) : null}
    </div>
  );
}
export function ToastRegion({ message }: { message?: ReactNode }) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="ah-toast"
      role="status"
    >
      {message}
    </div>
  );
}
export function StreamAnnouncer({ summaryText }: { summaryText: string }) {
  return (
    <p aria-atomic="true" aria-live="polite" className="ah-visually-hidden">
      {summaryText}
    </p>
  );
}
