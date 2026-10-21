import type { Recap } from "../app/conversations";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

export function relativeRecapAge(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "juuri nyt";
  if (minutes < 60) return `${minutes} min sitten`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t sitten`;
  return `${Math.floor(hours / 24)} pv sitten`;
}

export function RecapCard({
  recap,
  stale,
  pending,
  error,
  uncertain = false,
  unverifiable = false,
  unavailable,
  unavailableReason,
  onRequest,
  onDismiss,
  now = Date.now(),
}: {
  recap: Recap | null;
  stale: boolean;
  pending: boolean;
  error: boolean;
  uncertain?: boolean;
  unverifiable?: boolean;
  unavailable: boolean;
  unavailableReason?: string;
  onRequest?: () => void;
  onDismiss?: () => void;
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
      data-stale={stale}
      className="ah-recap"
      aria-label="Keskustelun yhteenveto"
    >
      <div className="ah-recap-heading">
        <strong>Tilannekatsaus</strong>
        {recap ? (
          <time dateTime={new Date(recap.generated_at).toISOString()}>
            {relativeRecapAge(recap.generated_at, now)}
          </time>
        ) : null}
        {stale ? <span className="ah-recap-stale">uusia viestejä</span> : null}
        {unverifiable ? (
          <span className="ah-recap-stale">ajantasaisuus ei tiedossa</span>
        ) : null}
        {recap?.trigger === "automatic" ? (
          <span className="ah-recap-auto">luotu automaattisesti</span>
        ) : null}
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
        <p className="ah-inline-error" role="alert">
          {unverifiable
            ? "Katsausta ei voitu tarkistaa. Lataa sivu uudelleen."
            : uncertain
              ? "Luonnin tulos ei ole tiedossa. Tarkista katsaus lataamalla sivu uudelleen."
              : "Katsausta ei voitu luoda. Yritä uudelleen."}
        </p>
      ) : null}
    </aside>
  );
}
