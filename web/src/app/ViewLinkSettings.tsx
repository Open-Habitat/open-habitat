import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { CopyButton, viewLinkTerms } from "../components/ViewLink";
import { liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import {
  type AdminViewLink,
  adminRevokeViewLink,
  adminViewLinks,
  formatExpiry,
  refreshViewLinks,
  revokeViewLink,
  useViewLinks,
} from "./viewLinks";

const txt = liveText(viewLinksText);

/** Tili › Jaetut linkit: every link the person has, to copy again or revoke,
 * also those whose view card is in a conversation long gone. Absent where
 * the site offers no links (ADR 0033). */
export function ViewLinkSettings({ csrf }: { csrf?: string }) {
  const links = useViewLinks();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  useEffect(() => {
    const abort = new AbortController();
    void refreshViewLinks(abort.signal).catch(() => {});
    return () => abort.abort();
  }, []);
  if (typeof links !== "object") return null;
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
        {links.links.length === 0 ? (
          <span className="s-desc">{txt.none}</span>
        ) : (
          <ul className="ah-view-links">
            {links.links.map((l) => (
              <li key={l.link_id} data-testid="view-link-row">
                <span>
                  <strong>{l.title}</strong>
                  <span className="s-desc">
                    {txt.validUntil(formatExpiry(l.expires_at))}
                  </span>
                </span>
                <CopyButton text={l.url} data-testid="view-link-row-copy" />
                <ControlButton
                  data-testid="view-link-row-revoke"
                  size="row"
                  variant="danger"
                  isDisabled={!csrf || busy === l.link_id}
                  onPress={() => {
                    if (!csrf) return;
                    setBusy(l.link_id);
                    setError("");
                    void revokeViewLink(csrf, l.link_id).then(
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
 * It shows who shared what and until when, never a link's address. */
export function ViewLinkAdministration({ csrf }: { csrf?: string }) {
  const [data, setData] = useState<{
    enabled: boolean;
    links: AdminViewLink[];
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const load = useCallback(async (signal?: AbortSignal) => {
    setData(await adminViewLinks(signal));
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal).catch(() => {
      if (!abort.signal.aborted) setError(txt.adminUnavailable);
    });
    return () => abort.abort();
  }, [load]);
  if (!data && !error) return null;
  if (data && !data.enabled && data.links.length === 0) return null;
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
        {data && data.links.length === 0 ? (
          <span className="s-desc">{txt.adminNone}</span>
        ) : data ? (
          <ul className="ah-view-links">
            {data.links.map((l) => (
              <li key={l.link_id} data-testid="view-link-admin-row">
                <span>
                  <strong>{l.title}</strong>
                  <span className="s-desc">
                    {txt.adminRow(
                      l.username,
                      formatExpiry(l.created_at),
                      formatExpiry(l.expires_at),
                    )}
                  </span>
                </span>
                <ControlButton
                  data-testid="view-link-admin-revoke"
                  size="row"
                  variant="danger"
                  isDisabled={!csrf || busy === l.link_id}
                  onPress={() => {
                    if (!csrf) return;
                    setBusy(l.link_id);
                    setError("");
                    void adminRevokeViewLink(csrf, l.link_id)
                      .then(() => load())
                      .catch((e: Error) => setError(e.message))
                      .finally(() => setBusy(undefined));
                  }}
                >
                  {txt.removeShort}
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
