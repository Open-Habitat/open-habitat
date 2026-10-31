import "./ViewLink.css";
import { useEffect, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import {
  daysLabel,
  defaultExpiry,
  expiryChoices,
  formatExpiry,
  type ViewLink,
} from "../app/viewLinks";
import { liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { ControlButton, Segmented } from "./ControlElements";
import { Icon } from "./Icon";
import { formatViewSize, type ViewSummary } from "./ViewOffer";

const txt = liveText(viewLinksText);

/** What a link means, said before it exists and whenever it is shown. */
export const viewLinkTerms = () => txt.terms;

/** Copies text and says so for a moment. */
export function CopyButton({
  text,
  "data-testid": testId,
  label = txt.copyLink,
}: {
  text: string;
  "data-testid"?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState<"yes" | "failed">();
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(undefined), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <ControlButton
      data-testid={testId ?? "view-link-copy"}
      size="row"
      onPress={() =>
        void navigator.clipboard.writeText(text).then(
          () => setCopied("yes"),
          () => setCopied("failed"),
        )
      }
    >
      <Icon name={copied === "yes" ? "check" : "copy"} />{" "}
      {copied === "yes"
        ? txt.copied
        : copied === "failed"
          ? txt.copyBlocked
          : label}
    </ControlButton>
  );
}

type Busy = "create" | "extend" | "repoint" | "address" | "revoke";

/** Jaa linkillä (ADR 0033): the person's one place to create a link to a
 * view and to copy, extend, re-point, re-address or revoke it. The view's
 * title is agent text, shown as data. */
export function ViewLinkDialog({
  isOpen,
  onClose,
  view,
  link,
  maxDays,
  otherViews = [],
  onCreate,
  onExtend,
  onRepoint,
  onNewAddress,
  onRevoke,
}: {
  isOpen: boolean;
  onClose: () => void;
  view: Pick<ViewSummary, "view_id" | "title" | "files" | "bytes">;
  /** The link that shows this view now, if any. */
  link?: ViewLink;
  maxDays: number;
  /** The person's other views, for pointing the link elsewhere. */
  otherViews?: readonly ViewSummary[];
  onCreate: (days: number) => Promise<unknown>;
  onExtend: (days: number) => Promise<unknown>;
  onRepoint: (viewId: string) => Promise<unknown>;
  onNewAddress: () => Promise<unknown>;
  onRevoke: () => Promise<unknown>;
}) {
  const [days, setDays] = useState(defaultExpiry(maxDays));
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<Busy>();
  const [error, setError] = useState("");
  const [revoked, setRevoked] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setDays(defaultExpiry(maxDays));
    setTarget("");
    setError("");
    setRevoked(false);
  }, [isOpen, maxDays]);
  const run = (kind: Busy, action: () => Promise<unknown>) => {
    setBusy(kind);
    setError("");
    void action().then(
      () => {
        setBusy(undefined);
        if (kind === "revoke") setRevoked(true);
        if (kind === "repoint") setTarget("");
      },
      (e: Error) => {
        setBusy(undefined);
        setError(e.message || txt.saveFailedShort);
      },
    );
  };
  const choices = expiryChoices(maxDays).map((d) => ({
    id: String(d),
    label: d === maxDays && d > 30 ? txt.atMost(daysLabel(d)) : daysLabel(d),
  }));
  const daysChoice = (testId: string) => (
    <Segmented
      data-testid={testId}
      label={txt.valid}
      options={choices}
      value={String(days)}
      isDisabled={!!busy}
      onChange={(id) => setDays(Number(id))}
    />
  );
  const others = otherViews.filter((v) => v.view_id !== view.view_id);
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="ah-overlay"
      isDismissable={!busy}
      isKeyboardDismissDisabled={!!busy}
    >
      <Modal className="ah-modal ah-view-link-modal">
        <AriaDialog
          className="ah-dialog ah-view-link"
          data-testid="view-link-dialog"
          aria-label={txt.share}
        >
          <Heading slot="title">{txt.share}</Heading>
          <p className="ah-view-link-what">
            <strong data-testid="view-link-title">{view.title}</strong>
            <span className="ah-view-offer-meta">
              {txt.files(view.files)} · {formatViewSize(view.bytes)}
            </span>
          </p>
          <p className="ah-view-link-terms">{viewLinkTerms()}</p>
          {revoked ? (
            <p role="status" data-testid="view-link-revoked">
              {txt.revoked}
            </p>
          ) : !link ? (
            <div className="ah-view-link-step">
              {daysChoice("view-link-days")}
              <ControlButton
                data-testid="view-link-create"
                size="row"
                variant="primary"
                isDisabled={!!busy}
                onPress={() => run("create", () => onCreate(days))}
              >
                {busy === "create" ? txt.creating : txt.create}
              </ControlButton>
            </div>
          ) : (
            <>
              <div className="ah-view-link-url">
                <input
                  data-testid="view-link-url"
                  aria-label={txt.link}
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <CopyButton text={link.url} />
              </div>
              <p className="ah-view-offer-meta" data-testid="view-link-expiry">
                {txt.validUntil(formatExpiry(link.expires_at))}.
              </p>
              <section className="ah-view-link-step" aria-label={txt.extend}>
                <span className="ah-view-link-step-label">
                  {txt.extendHint}
                </span>
                {daysChoice("view-link-extend-days")}
                <ControlButton
                  data-testid="view-link-extend"
                  size="row"
                  isDisabled={!!busy}
                  onPress={() => run("extend", () => onExtend(days))}
                >
                  {txt.extend}
                </ControlButton>
              </section>
              {others.length > 0 && (
                <section className="ah-view-link-step" aria-label={txt.repoint}>
                  <label className="ah-view-link-step-label">
                    {txt.repointHint}
                    <select
                      data-testid="view-link-target"
                      value={target}
                      disabled={!!busy}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">{txt.chooseView}</option>
                      {others.map((v) => (
                        <option key={v.view_id} value={v.view_id}>
                          {v.title} ({formatExpiry(v.created_at)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <ControlButton
                    data-testid="view-link-repoint"
                    size="row"
                    isDisabled={!!busy || !target}
                    onPress={() => run("repoint", () => onRepoint(target))}
                  >
                    {txt.repoint}
                  </ControlButton>
                </section>
              )}
              <section className="ah-view-link-step" aria-label={txt.readdress}>
                <span className="ah-view-link-step-label">
                  {txt.readdressHint}
                </span>
                <ControlButton
                  data-testid="view-link-new-address"
                  size="row"
                  isDisabled={!!busy}
                  onPress={() => run("address", onNewAddress)}
                >
                  {txt.readdress}
                </ControlButton>
              </section>
            </>
          )}
          {error && (
            <p role="alert" data-testid="view-link-error">
              {error}
            </p>
          )}
          <div className="ah-dialog-actions">
            {link && !revoked && (
              <ControlButton
                data-testid="view-link-revoke"
                size="page"
                variant="danger"
                isDisabled={!!busy}
                onPress={() => run("revoke", onRevoke)}
              >
                {txt.remove}
              </ControlButton>
            )}
            <ControlButton
              data-testid="view-link-close"
              size="page"
              variant="secondary"
              slot="close"
              isDisabled={!!busy}
            >
              {txt.close}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
