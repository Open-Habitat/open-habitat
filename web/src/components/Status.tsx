import type { ReactNode } from "react";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import { Icon } from "./Icon";
import { Button } from "./Primitives";
import type { Action, ProblemView, Tone } from "./types";

const txt = liveText(statusText);

export type StatusKind =
  | "working"
  | "read-only"
  | "success"
  | "error"
  | "unknown"
  | "background"
  | "pill"
  | "neutral";
export function StatusMark({
  "data-testid": testId,
  label,
  tone = "neutral",
  animated = false,
  kind = "neutral",
}: {
  label: string;
  tone?: Tone;
  animated?: false | "running";
  kind?: StatusKind;
  "data-testid"?: string;
}) {
  return (
    <span
      data-animated={animated || undefined}
      data-kind={kind}
      data-testid={testId ?? "status-mark"}
      className={`ah-status ah-tone-${tone} ah-status-${kind}`}
    >
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
  "data-state": state,
  "data-testid": testId,
  title,
  description,
  tone = "info",
  problem,
  actions = [],
}: {
  "data-state"?: string;
  "data-testid"?: string;
  title: string;
  description?: string;
  tone?: Tone;
  problem?: ProblemView;
  actions?: Action[];
}) {
  return (
    <aside
      data-state={state}
      data-testid={testId}
      className={`ah-notice ah-tone-${tone}`}
    >
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      <Problem problem={problem} />
      {actions.length ? (
        <div className="ah-actions">
          {actions.map((action) => (
            <Button
              size="row"
              data-testid={action.testId ?? "notice-action"}
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
  | "connecting"
  | "reconnecting"
  | "stale"
  | "resnapshot-required"
  | "version-changed"
  | "authentication-required"
  | "daemon-unavailable"
  | "host-read-only";
export function ConnectionBanner({
  state,
  lastConfirmedAt,
  connectionDetail,
  hostWriteState = "writable",
  problem,
  onRetry,
  onReload,
}: {
  state: ConnectionState;
  lastConfirmedAt?: string;
  connectionDetail?: string;
  hostWriteState?: "writable" | "read_only";
  problem?: ProblemView;
  onRetry?: () => void;
  /** Loads the bundle the server serves now; "version-changed" offers it. */
  onReload?: () => void;
}) {
  // Snapshot write_state describes workspace mutations, not conversation control.
  // It is not a connectivity failure and does not need a page-wide warning.
  if (state === "online") return null;
  const visibleState = state;
  const copy: Record<
    Exclude<ConnectionState, "online">,
    { title: string; detail: string; tone: Tone }
  > = {
    loading: { ...txt.connection.loading, tone: "neutral" },
    connecting: { ...txt.connection.connecting, tone: "neutral" },
    reconnecting: { ...txt.connection.reconnecting, tone: "warning" },
    stale: {
      title: txt.connection.stale.title,
      detail: txt.staleDetail(lastConfirmedAt || undefined),
      tone: "warning",
    },
    "resnapshot-required": {
      ...txt.connection["resnapshot-required"],
      tone: "warning",
    },
    "version-changed": {
      ...txt.connection["version-changed"],
      tone: "warning",
    },
    "authentication-required": {
      ...txt.connection["authentication-required"],
      tone: "danger",
    },
    "daemon-unavailable": {
      ...txt.connection["daemon-unavailable"],
      tone: "danger",
    },
    "host-read-only": { ...txt.connection["host-read-only"], tone: "warning" },
  };
  const value = copy[visibleState as Exclude<ConnectionState, "online">];
  const urgent =
    visibleState === "authentication-required" ||
    visibleState === "daemon-unavailable";
  return (
    <div
      data-testid={`connection-${visibleState}`}
      data-state={state}
      className={`ah-connection ah-tone-${value.tone}`}
      role={urgent ? "alert" : "status"}
    >
      <strong>{value.title}</strong>
      <span>
        {connectionDetail ? `${connectionDetail} ` : ""}
        {value.detail}
        {hostWriteState === "read_only" &&
        visibleState !== "host-read-only" &&
        visibleState !== "stale"
          ? txt.alsoReadOnly
          : ""}
      </span>
      {visibleState === "stale" ? (
        <span className="ah-connection-mobile-detail">{txt.lastConfirmed}</span>
      ) : null}
      <Problem problem={problem} />
      {visibleState === "version-changed" ? (
        onReload ? (
          <Button
            data-testid="connection-reload"
            label={txt.reload}
            variant="secondary"
            size="row"
            onPress={onReload}
          />
        ) : null
      ) : onRetry ? (
        <Button
          data-testid="connection-retry"
          label={
            state === "stale" ||
            state === "reconnecting" ||
            state === "connecting"
              ? txt.connect
              : txt.retry
          }
          variant="secondary"
          size="row"
          pending={state === "connecting"}
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
      data-testid="toast"
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
