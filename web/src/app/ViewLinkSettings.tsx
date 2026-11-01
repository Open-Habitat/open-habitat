import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { CopyButton, viewLinkTerms } from "../components/ViewLink";
import { liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import {
  type AdminViewPublication,
  adminDeleteViewAddress,
  adminViewPublications,
  formatExpiry,
  isPublic,
  makeViewAddressPrivate,
  refreshViewLinks,
  useViewLinks,
} from "./viewLinks";

const txt = liveText(viewLinksText);

/** Tili › Jaetut linkit: every view the person shares now, to copy its link
 * again or stop sharing, also those whose view card is in a conversation
 * long gone. Absent where the site shares nothing publicly. */
export function ViewLinkSettings({ csrf }: { csrf?: string }) {
  const links = useViewLinks();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  useEffect(() => {
    const abort = new AbortController();
    void refreshViewLinks(abort.signal).catch(() => {});
    return () => abort.abort();
  }, []);
  if (typeof links !== "object" || links.maxDays === 0) return null;
  const shared = links.addresses.filter((a) => isPublic(a));
  return (
    <section
      data-testid="view-links"
      className="s-row"
      data-settings-row="view-links"
      tabIndex={-1}
      aria-label={txt.shared}
    >
      <div className="s-lbl">
        <strong>{txt.shared}</strong>
        <span className="s-desc">{viewLinkTerms()}</span>
      </div>
      <div className="s-val">
        {shared.length === 0 ? (
          <span className="s-desc">{txt.none}</span>
        ) : (
          <ul className="ah-view-links">
            {shared.map((l) => (
              <li key={l.address_id} data-testid="view-link-row">
                <span>
                  <strong>{l.title}</strong>
                  <span className="s-desc">
                    {txt.validUntil(formatExpiry(l.public_until ?? ""))}
                  </span>
                </span>
                <CopyButton
                  text={l.content_url}
                  data-testid="view-link-row-copy"
                />
                <ControlButton
                  data-testid="view-link-row-revoke"
                  size="row"
                  variant="danger"
                  isDisabled={!csrf || busy === l.address_id}
                  onPress={() => {
                    if (!csrf) return;
                    setBusy(l.address_id);
                    setError("");
                    void makeViewAddressPrivate(csrf, l.address_id).then(
                      () => setBusy(undefined),
                      (e: Error) => {
                        setBusy(undefined);
                        setError(e.message);
                      },
                    );
                  }}
                >
                  {txt.removeShort}
                </ControlButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="s-editor" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Käyttäjät ja pääsy › Jaetut linkit: the administrator's abuse response.
 * It shows who shares what and until when, never an address, and deletes
 * an address for good. */
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
