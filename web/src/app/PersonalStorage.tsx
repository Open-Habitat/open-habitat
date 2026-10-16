import { useEffect, useState } from "react";
import { bytes, ownStorage, type Quota } from "./storageQuota";

// The subject is resolved by the gateway from the current cookie, never sent by this view.
export function PersonalStorage() {
  const [quota, setQuota] = useState<Quota>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void ownStorage(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setQuota(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <section aria-label="Tallennustila">
      <h2>Tallennustila</h2>
      {quota ? (
        <div className="s-row">
          <div className="s-lbl">
            <strong>Käyttö</strong>
            <span className="s-desc">
              Koko kotihakemistosi: työtilat, Pi:n historia ja välimuistit.
            </span>
          </div>
          <div>
            Käytössä {bytes(quota.usage_bytes)} / {bytes(quota.limit_bytes)}.
            <div
              className="s-bar"
              role="img"
              aria-label="Tallennustilan käyttö"
            >
              <span
                style={{
                  width: `${quota.limit_bytes ? Math.min(100, (100 * quota.usage_bytes) / quota.limit_bytes) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : error ? (
        <p>Tallennustietoa ei voitu hakea.</p>
      ) : (
        <p>Haetaan tallennustietoa…</p>
      )}
    </section>
  );
}
