import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { CopyButton, viewLinkTerms } from "../components/ViewLink";
import {
  type AdminViewLink,
  adminRevokeViewLink,
  adminViewLinks,
  formatExpiry,
  refreshViewLinks,
  revokeViewLink,
  useViewLinks,
} from "./viewLinks";

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
      aria-label="Jaetut linkit"
    >
      <div className="s-lbl">
        <strong>Jaetut linkit</strong>
        <span className="s-desc">{viewLinkTerms}</span>
      </div>
      <div className="s-val">
        {links.links.length === 0 ? (
          <span className="s-desc">
            Et ole jakanut näkymiä. Jaa näkymä sen kortin painikkeella Jaa
            linkillä.
          </span>
        ) : (
          <ul className="ah-view-links">
            {links.links.map((l) => (
              <li key={l.link_id} data-testid="view-link-row">
                <span>
                  <strong>{l.title}</strong>
                  <span className="s-desc">
                    Voimassa {formatExpiry(l.expires_at)} asti
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
                  Poista
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
      if (!abort.signal.aborted) setError("Jaettuja linkkejä ei voitu ladata.");
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
      aria-label="Jaetut linkit"
    >
      <div className="s-lbl">
        <strong>Jaetut linkit</strong>
        <span className="s-desc">
          Henkilöiden jakamat näkymät. Kuka tahansa linkin saanut voi avata ne.
          Poista linkki, jota käytetään väärin.
          {data && !data.enabled
            ? " Linkit eivät nyt ole käytössä tällä palvelimella."
            : ""}
        </span>
      </div>
      <div className="s-val">
        {data && data.links.length === 0 ? (
          <span className="s-desc">Kukaan ei ole jakanut näkymiä.</span>
        ) : data ? (
          <ul className="ah-view-links">
            {data.links.map((l) => (
              <li key={l.link_id} data-testid="view-link-admin-row">
                <span>
                  <strong>{l.title}</strong>
                  <span className="s-desc">
                    {l.username} · jaettu {formatExpiry(l.created_at)} ·
                    voimassa {formatExpiry(l.expires_at)} asti
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
                  Poista
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
