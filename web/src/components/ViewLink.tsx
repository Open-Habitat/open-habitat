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
  type ViewAddress,
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

type Busy = "create" | "extend" | "revoke";

/** Jaa linkillä: the person's one place to share a view publicly and to
 * copy, extend or stop sharing it. The view keeps one address (ADR 0035):
 * sharing again revives the same link. The view's title is agent text,
 * shown as data. */
export function ViewLinkDialog({
  isOpen,
  onClose,
  view,
  link,
  maxDays,
  onCreate,
  onExtend,
  onRevoke,
}: {
  isOpen: boolean;
  onClose: () => void;
  view: Pick<ViewSummary, "view_id" | "title" | "files" | "bytes">;
  /** The view's address while it is public. */
  link?: ViewAddress;
  maxDays: number;
  onCreate: (days: number) => Promise<unknown>;
  onExtend: (days: number) => Promise<unknown>;
  onRevoke: () => Promise<unknown>;
}) {
  const [days, setDays] = useState(defaultExpiry(maxDays));
  const [busy, setBusy] = useState<Busy>();
  const [error, setError] = useState("");
  const [revoked, setRevoked] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setDays(defaultExpiry(maxDays));
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
                  value={link.content_url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <CopyButton text={link.content_url} />
              </div>
              <p className="ah-view-offer-meta" data-testid="view-link-expiry">
                {txt.validUntil(formatExpiry(link.public_until ?? ""))}.
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
