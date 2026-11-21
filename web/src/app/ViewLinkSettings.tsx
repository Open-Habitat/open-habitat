import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import {
  type AdminViewPublication,
  adminDeleteViewAddress,
  adminViewPublications,
  formatExpiry,
} from "./viewLinks";

const txt = liveText(viewLinksText);

/** The administrator's abuse response shows publication metadata, never
 * an address, and deletes an address for good. */
export function ViewLinkAdministration({ csrf }: { csrf?: string }) {
  const [data, setData] = useState<{
    enabled: boolean;
    publications: AdminViewPublication[];
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const load = useCallback(async (signal?: AbortSignal) => {
    setData(await adminViewPublications(signal));
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal).catch(() => {
      if (!abort.signal.aborted) setError(txt.adminUnavailable);
    });
    return () => abort.abort();
  }, [load]);
  if (!data && !error) return null;
  if (data && !data.enabled && data.publications.length === 0) return null;
  return (
    <section
      data-testid="view-links-admin"
      className="s-row"
      data-settings-row="view-links-admin"
      tabIndex={-1}
      aria-label={txt.shared}
    >
      <div className="s-lbl">
        <strong>{txt.shared}</strong>
        <span className="s-desc">
          {txt.adminDesc}
          {data && !data.enabled ? txt.adminOff : ""}
        </span>
      </div>
      <div className="s-val">
        {data && data.publications.length === 0 ? (
          <span className="s-desc">{txt.adminNone}</span>
        ) : data ? (
          <ul className="ah-view-links">
            {data.publications.map((l) => (
              <li key={l.address_id} data-testid="view-link-admin-row">
                <span>
                  <strong>{l.title}</strong>
                  <span className="s-desc">
                    {txt.adminRow(l.username, formatExpiry(l.public_until))}
                  </span>
                </span>
                <ControlButton
                  data-testid="view-link-admin-revoke"
                  size="row"
                  variant="danger"
                  isDisabled={!csrf || busy === l.address_id}
                  onPress={() => {
                    if (!csrf) return;
                    setBusy(l.address_id);
                    setError("");
                    void adminDeleteViewAddress(csrf, l.address_id)
                      .then(() => load())
                      .catch((e: Error) => setError(e.message))
                      .finally(() => setBusy(undefined));
                  }}
                >
                  {txt.deleteShort}
                </ControlButton>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error && (
        <p className="s-editor" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
