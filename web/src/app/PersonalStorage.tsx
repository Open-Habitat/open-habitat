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
        <p>
          Käytössä {bytes(quota.usage_bytes)} / {bytes(quota.limit_bytes)}.
        </p>
      ) : error ? (
        <p>Tallennustietoa ei voitu hakea.</p>
      ) : (
        <p>Haetaan tallennustietoa…</p>
      )}
    </section>
  );
}
