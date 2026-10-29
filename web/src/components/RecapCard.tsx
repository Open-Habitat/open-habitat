import { useEffect, useState } from "react";
import type { Recap, RecapFailureReason } from "../app/conversations";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon } from "./Icon";

export function relativeRecapAge(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "juuri nyt";
  if (minutes < 60) return `${minutes} min sitten`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t sitten`;
  return `${Math.floor(hours / 24)} pv sitten`;
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

/** Why no recap was written, in words the person can act on. Every reason
 * the daemon reports has one, so a failure never shows as silence. */
const failureText: Record<RecapFailureReason, string> = {
  no_message: "Keskustelussa ei ole vielä viestejä.",
  no_model: "Katsaukselle ei löytynyt mallia, johon on kirjautuminen.",
  model_error: "Malli ei vastannut katsauspyyntöön.",
  model_timeout: "Malli ei vastannut ajoissa.",
  model_incomplete: "Mallin vastaus jäi kesken.",
  invalid_response: "Mallin vastauksesta ei saatu katsausta.",
  superseded: "Keskustelu jatkui ennen kuin katsaus valmistui.",
  busy: "Edellinen katsaus on vielä tekeillä.",
  write_failed: "Katsausta ei voitu tallentaa keskusteluun.",
  history_unavailable: "Keskustelun historiaa ei voitu lukea.",
  command_unavailable: "Agentti ei tarjonnut katsaustoimintoa.",
  controller_unavailable: "Yhteys agenttiin katkesi kesken katsauksen.",
  outcome_unknown: "Katsauksen tulosta ei saatu agentilta.",
  not_written: "Katsaus ei tallentunut keskusteluun.",
};

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
  now?: number;
}) {
  const reason = unavailable
    ? (unavailableReason ?? "Yhteys tai ohjaus ei ole käytettävissä.")
    : pending
      ? "Katsausta luodaan."
      : "";
  return (
    <aside
      data-testid="recap-card"
      data-trigger={recap?.trigger}
      className="ah-recap"
      aria-label="Keskustelun yhteenveto"
    >
      <div className="ah-recap-heading">
        <strong data-testid="recap-heading">Tilannekatsaus</strong>
        {recap ? <LatestMessageAge at={latestAt} now={now} /> : null}
        <span className="ah-recap-grow" />
        {onRequest ? (
          <span title={reason || (recap ? "Päivitä katsaus" : "Luo katsaus")}>
            <ControlButton
              data-testid="recap-refresh"
              className="ah-recap-icon"
              variant="quiet"
              size="inline"
              aria-label={recap ? "Päivitä katsaus" : "Luo katsaus"}
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
            aria-label="Tilannekatsauksen asetukset"
            title="Tilannekatsauksen asetukset"
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
            aria-label="Sulje katsaus"
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
          aria-label="Luodaan katsausta"
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
              <strong>Seuraavaksi</strong> {recap.next}
            </p>
          ) : null}
        </>
      ) : (
        <p className="ah-recap-empty">Pyydä lyhyt katsaus ennen kuin jatkat.</p>
      )}
      {error || uncertain || unverifiable ? (
        <p
          className="ah-inline-error"
          role="alert"
          data-testid="recap-failure"
          data-reason={
            error && !unverifiable && !uncertain ? failure : undefined
          }
        >
          {unverifiable
            ? "Katsausta ei voitu tarkistaa. Lataa sivu uudelleen."
            : uncertain
              ? "Luonnin tulos ei ole tiedossa. Tarkista katsaus lataamalla sivu uudelleen."
              : `Katsausta ei voitu luoda.${failure ? ` ${failureText[failure]}` : ""} Yritä uudelleen.`}
        </p>
      ) : null}
    </aside>
  );
}
