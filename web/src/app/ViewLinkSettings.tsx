import { useCallback, useEffect, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ControlButton } from "../components/ControlElements";
import { CopyButton } from "../components/ViewLink";
import { liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { useExperimentalFeature } from "./accountPreferences";
import {
  type AdminViewPublication,
  addressItem,
  adminDeleteViewAddress,
  adminViewPublications,
  deleteViewAddressForGood,
  formatExpiry,
  isPublic,
  refreshViewLinks,
  stopViewSharing,
  useViewAddressMark,
  useViewLinks,
  useViewLinksUnknown,
  type ViewAddress,
} from "./viewLinks";

const txt = liveText(viewLinksText);

/** Tili › Näkymien ja tiedostojen osoitteet: every address the person's
 * views and file offers have, private,
 * public or past their publication, also those whose view card is in a
 * conversation long gone or whose export no longer exists (ADR 0035). Here
 * the person opens or copies one, makes it private, and deletes it for
 * good, also while the site shares nothing publicly: an address is never
 * evicted, so this is the way out of the reservation cap. */
export function ViewLinkSettings({ csrf }: { csrf?: string }) {
  const sharesOn = useExperimentalFeature("shares-page");
  const links = useViewLinks();
  const unknown = useViewLinksUnknown();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<ViewAddress>();
  useEffect(() => {
    const abort = new AbortController();
    void refreshViewLinks(abort.signal).catch(() => {});
    return () => abort.abort();
  }, []);
  if (sharesOn || links === undefined || links === "off") return null;
  const sharing = typeof links === "object" && links.maxDays > 0;
  const rows =
    typeof links === "object"
      ? [...links.addresses].sort(
          (a, b) =>
            Number(isPublic(b)) - Number(isPublic(a)) ||
            b.created_at.localeCompare(a.created_at),
        )
      : [];
  const act = (write: Promise<void>) => {
    setError("");
    void write.catch((e: Error) => setError(e.message));
  };
  return (
    <section
      data-testid="view-links"
      className="s-row"
      data-settings-row="view-links"
      tabIndex={-1}
      aria-label={txt.addresses}
    >
      <div className="s-lbl">
        <strong>{txt.addresses}</strong>
        <span className="s-desc">{txt.addressesDesc}</span>
      </div>
      <div className="s-val">
        {links === "unavailable" ? (
          <span className="s-desc">{txt.addressesUnknown}</span>
        ) : rows.length === 0 ? (
          <span className="s-desc">{txt.noAddresses}</span>
        ) : (
          <ul className="ah-view-links">
            {rows.map((a) => (
              <AddressRow
                key={a.address_id}
                address={a}
                sharing={sharing}
                unknown={unknown}
                csrf={csrf}
                onStop={() => csrf && act(stopViewSharing(csrf, a))}
                onRemove={() => setRemoving(a)}
              />
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="s-editor" role="alert">
          {error}
        </p>
      )}
      <ModalOverlay
        isOpen={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(undefined);
        }}
        className="ah-overlay"
        isDismissable
      >
        <Modal className="ah-modal">
          <AriaDialog
            className="ah-dialog"
            role="alertdialog"
            data-testid="view-address-remove-dialog"
            aria-label={txt.removeTitle}
          >
            <Heading slot="title">{txt.removeTitle}</Heading>
            <p>{removing ? txt.removeDesc(removing.title) : ""}</p>
            <div className="ah-dialog-actions">
              <ControlButton
                data-testid="cancel"
                size="page"
                variant="secondary"
                slot="close"
                autoFocus
              >
                {txt.cancel}
              </ControlButton>
              <ControlButton
                data-testid="view-address-remove-confirm"
                size="page"
                variant="danger"
                onPress={() => {
                  const target = removing;
                  setRemoving(undefined);
                  if (csrf && target)
                    act(deleteViewAddressForGood(csrf, target));
                }}
              >
                {txt.removeConfirm}
              </ControlButton>
            </div>
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </section>
  );
}

function AddressRow({
  address,
  sharing,
  unknown,
  csrf,
  onStop,
  onRemove,
}: {
  address: ViewAddress;
  sharing: boolean;
  unknown: boolean;
  csrf?: string;
  onStop: () => void;
  onRemove: () => void;
}) {
  const mark = useViewAddressMark(addressItem(address));
  const busy = mark === "busy";
  const unsure = unknown || mark === "uncertain";
  const shown = isPublic(address);
  const until = shown ? formatExpiry(address.public_until ?? "") : "";
  return (
    <li
      data-testid="view-address-row"
      data-address-id={address.address_id}
      data-public={String(shown)}
    >
      <span>
        <strong>{address.title}</strong>
        <span className="s-desc">
          {unsure
            ? txt.checking
            : !shown
              ? txt.isPrivate
              : sharing
                ? txt.publicUntil(until)
                : txt.paused(until)}
        </span>
      </span>
      <ControlButton
        data-testid="view-address-open"
        size="row"
        onPress={() =>
          window.open(address.url, "_blank", "noopener,noreferrer")
        }
      >
        {txt.open}
      </ControlButton>
      {shown && sharing && !unsure && (
        <CopyButton text={address.url} data-testid="view-address-copy" />
      )}
      {shown && (
        <ControlButton
          data-testid="view-address-private"
          size="row"
          isDisabled={!csrf || busy}
          onPress={onStop}
        >
          {txt.stop}
        </ControlButton>
      )}
      <ControlButton
        data-testid="view-address-remove"
        size="row"
        variant="danger"
        isDisabled={!csrf || busy}
        onPress={onRemove}
      >
        {txt.remove}
      </ControlButton>
    </li>
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
