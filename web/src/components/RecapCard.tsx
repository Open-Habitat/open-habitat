import type { Recap } from "../app/conversations";
import { Button } from "./Primitives";
import { StatusMark } from "./Status";

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
}) {
  const age = recap ? new Date(recap.generated_at).toLocaleString() : "";
  return (
    <aside className="ah-recap" aria-label="Keskustelun yhteenveto">
      <div className="ah-recap-heading">
        <strong>Tilannekatsaus</strong>
        {recap ? (
          <StatusMark
            label={
              unverifiable
                ? "Ajantasaisuus ei tiedossa"
                : stale
                  ? "Vanha – uusia viestejä"
                  : `Luotu ${age}`
            }
            tone={unverifiable || stale ? "warning" : "neutral"}
          />
        ) : null}
      </div>
      {recap ? (
        <>
          <p>{recap.recap}</p>
          {recap.next ? (
            <p className="ah-recap-next">
              <strong>Seuraavaksi voisi:</strong> {recap.next}
            </p>
          ) : null}
        </>
      ) : (
        <p className="ah-recap-empty">Pyydä lyhyt katsaus ennen kuin jatkat.</p>
      )}
      <div className="ah-recap-actions">
        {onRequest ? (
          <Button
            label={recap ? "Päivitä katsaus" : "Luo katsaus"}
            variant="secondary"
            pending={pending}
            availability={
              unavailable || pending
                ? {
                    state: "unknown",
                    reason: unavailable
                      ? (unavailableReason ??
                        "Yhteys tai ohjaus ei ole käytettävissä.")
                      : "Katsausta luodaan.",
                  }
                : { state: "enabled" }
            }
            onPress={onRequest}
          />
        ) : null}
        {pending ? <span role="status">Luodaan katsaus…</span> : null}
      </div>
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
