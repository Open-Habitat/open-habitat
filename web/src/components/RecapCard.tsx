import { useEffect, useState } from "react";
import type { Recap, RecapFailureReason } from "../app/conversations";
import { liveText, textNow } from "../i18n";
import { navigationText } from "../text/navigation";
import { recapCardText } from "../text/recapCard";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon } from "./Icon";

const txt = liveText(recapCardText);

export function relativeRecapAge(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  const t = textNow(navigationText);
  if (minutes < 1) return t.agoJustNow;
  if (minutes < 60) return t.agoMinutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.agoHours(hours);
  return t.agoDays(Math.floor(hours / 24));
}

/** A clock for relative ages that moves on once a minute. */
export function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** How long the conversation has been quiet: the age of its latest native
 * message, not of the recap (Jari 27.10.2026). */
export function LatestMessageAge({
  at,
  now,
}: {
  at: string | null | undefined;
  now: number;
}) {
  const time = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(time)) return null;
  return (
    <time data-testid="recap-age" dateTime={at ?? undefined}>
      {relativeRecapAge(time, now)}
    </time>
  );
}

export function RecapCard({
  recap,
  latestAt,
  pending,
  error,
  failure,
  uncertain = false,
  unverifiable = false,
  unavailable,
  unavailableReason,
  onRequest,
  onDismiss,
  settingsHref,
  onOpenSettings,
  now = Date.now(),
}: {
  recap: Recap | null;
  latestAt?: string | null;
  pending: boolean;
  error: boolean;
  /** The daemon's reason for the failed attempt, when it gave one. */
  failure?: RecapFailureReason;
  uncertain?: boolean;
  unverifiable?: boolean;
  unavailable: boolean;
  unavailableReason?: string;
  onRequest?: () => void;
  onDismiss?: () => void;
  /** Tilannekatsaus settings, where the card's timing and length are set. */
  settingsHref?: string;
  /** Opens them inside the app, over this conversation, so closing Settings
   * returns to it; the link still opens in a new tab as itself. */
  onOpenSettings?: () => void;
  now?: number;
}) {
  // An invitation to ask beside the failure of the last ask contradicts it.
  const failed = error || uncertain || unverifiable;
  const reason = unavailable
    ? (unavailableReason ?? txt.unavailable)
    : pending
      ? txt.pending
      : "";
  return (
    <aside
      data-testid="recap-card"
      data-trigger={recap?.trigger}
      className="ah-recap"
      aria-label={txt.label}
    >
      <div className="ah-recap-heading">
        <strong data-testid="recap-heading">{txt.heading}</strong>
        {recap ? <LatestMessageAge at={latestAt} now={now} /> : null}
        <span className="ah-recap-grow" />
        {onRequest ? (
          <span title={reason || (recap ? txt.refresh : txt.create)}>
            <ControlButton
              data-testid="recap-refresh"
              className="ah-recap-icon"
              variant="quiet"
              size="inline"
              aria-label={recap ? txt.refresh : txt.create}
              aria-description={reason || undefined}
              isDisabled={!!reason}
              onPress={onRequest}
            >
              <Icon name="refresh" />
            </ControlButton>
          </span>
        ) : null}
        {settingsHref ? (
          <a
            data-testid="recap-settings-link"
            className={`ah-recap-icon ${controlClassName({ variant: "quiet", size: "inline", presentation: "icon" })}`}
            href={settingsHref}
            onClick={(event) => {
              if (
                !onOpenSettings ||
                event.button ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              onOpenSettings();
            }}
            aria-label={txt.settings}
            title={txt.settings}
          >
            <Icon name="gear" />
          </a>
        ) : null}
        {onDismiss ? (
          <ControlButton
            data-testid="recap-dismiss"
            className="ah-recap-icon"
            variant="quiet"
            size="inline"
            aria-label={txt.dismiss}
            onPress={onDismiss}
          >
            <Icon name="cross" />
          </ControlButton>
        ) : null}
      </div>
      {pending ? (
        <div
          className="ah-recap-skeleton"
          role="status"
          aria-label={txt.creating}
        >
          <span />
          <span />
          <span />
        </div>
      ) : recap ? (
        <>
          <p>{recap.recap}</p>
          {recap.next ? (
            <p className="ah-recap-next">
              <strong>{txt.next}</strong> {recap.next}
            </p>
          ) : null}
        </>
      ) : failed ? null : (
        <p className="ah-recap-empty" data-testid="recap-empty">
          {txt.empty}
        </p>
      )}
      {failed ? (
        <p
          className="ah-inline-error"
          role="alert"
          data-testid="recap-failure"
          data-reason={
            error && !unverifiable && !uncertain ? failure : undefined
          }
        >
          {unverifiable
            ? txt.unverifiable
            : uncertain
              ? txt.uncertain
              : `${txt.failed}${failure ? ` ${txt.failures[failure]}` : ""} ${failure === "model_timeout" ? txt.timeoutAction : txt.retry}`}
        </p>
      ) : null}
    </aside>
  );
}
