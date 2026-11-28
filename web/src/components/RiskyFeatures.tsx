import { useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import type { RiskyAllowance, RiskyFeatureId } from "../app/accountPreferences";
import { formatDate, useText } from "../i18n";
import { riskyFeaturesText } from "../text/riskyFeatures";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./RiskyFeatures.css";

/** The warning window *Salli…* opens: what the feature allows and to whom,
 * what it never does, and that the choice is the account's on every device.
 * Esc, a press outside and *Peru* leave it off. */
function AllowDialog({
  id,
  onConfirm,
  onCancel,
}: {
  id: RiskyFeatureId;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useText(riskyFeaturesText);
  const f = t.features[id];
  return (
    <ModalOverlay
      isOpen
      isDismissable
      className="ah-overlay rk-overlay"
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Modal className="ah-modal rk-modal">
        <AriaDialog
          data-testid="risky-allow-dialog"
          className="ah-dialog rk-dialog"
          role="alertdialog"
        >
          <Heading slot="title">{f.ask}</Heading>
          <div className="rk-warn" data-testid="risky-allow-warning">
            <Icon name="warning" />
            <div>
              <p>
                <b>{t.whenOn}</b> {f.desc}
              </p>
              <p>{f.allows}</p>
            </div>
          </div>
          <p className="rk-note">
            <b>{t.neverLabel}</b> {f.never}
          </p>
          <p className="rk-note">{t.scope}</p>
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="risky-allow-confirm"
              size="page"
              variant="primary"
              onPress={onConfirm}
            >
              {f.confirm}
            </ControlButton>
            <ControlButton
              data-testid="risky-allow-cancel"
              size="page"
              variant="quiet"
              autoFocus
              onPress={onCancel}
            >
              {t.cancel}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Settings › Vaaralliset toiminnot (risky-features-settings, Jari
 * 28.11.2026): one calm card of rows, deliberately unlike Kokeelliset's
 * picture cards. A row names the feature, says in one line what it does,
 * states in a word whether it is allowed and has one button that names the
 * act; what it allows is always in view, and while it is on that sentence
 * gets a soft danger edge and the row says since when. Allowing goes
 * through the warning window; turning off happens at once. A choice shows
 * only once the daemon has confirmed it. */
export function RiskyFeaturesControl({
  features,
  allowed,
  disabled,
  busy,
  error,
  onChange,
  onReload,
}: {
  features: readonly RiskyFeatureId[];
  allowed: (id: RiskyFeatureId) => RiskyAllowance | undefined;
  /** No button can be used: not yet read, or another write is in flight. */
  disabled: boolean;
  /** The feature whose write is in flight. */
  busy?: RiskyFeatureId;
  /** "read", or the feature whose write failed. */
  error?: string;
  onChange: (id: RiskyFeatureId, allowed: boolean) => void;
  onReload?: () => void;
}) {
  const t = useText(riskyFeaturesText);
  const [asking, setAsking] = useState<RiskyFeatureId>();
  const alert = (testId: string, text: string) => (
    <div className="s-row rk-alert">
      <p role="alert" data-testid={testId}>
        {text}
      </p>
      {onReload && (
        <ControlButton
          data-testid={`${testId}-reload`}
          size="row"
          onPress={onReload}
          isDisabled={!!busy}
        >
          {t.reload}
        </ControlButton>
      )}
    </div>
  );
  const since = (at: string) => {
    const when = new Date(at);
    return t.since(
      formatDate(when, { day: "numeric", month: "numeric", year: "numeric" }),
      formatDate(when, { hour: "numeric", minute: "2-digit" }),
    );
  };
  return (
    <div className="s-stack" data-testid="risky-features">
      <p className="s-intro">{t.intro}</p>
      {error === "read" && (
        <div className="s-card">{alert("risky-read-error", t.readError)}</div>
      )}
      <div className="s-card rk-card">
        {features.map((id) => {
          const f = t.features[id];
          const on = allowed(id);
          return (
            <section
              key={id}
              className="rk-member"
              data-settings-row={id}
              data-testid={`risky-${id}`}
              data-on={on ? "" : undefined}
              aria-label={f.name}
              aria-busy={busy === id || undefined}
              tabIndex={-1}
            >
              <div className="s-row">
                <div className="s-lbl">
                  <strong>{f.name}</strong>
                  <span className="s-desc">{f.desc}</span>
                </div>
                <div className="s-val">
                  <span
                    className="rk-state"
                    data-testid={`risky-${id}-state`}
                    data-on={on ? "" : undefined}
                  >
                    {on && <Icon name="warning" />}
                    {on ? t.allowed : t.notAllowed}
                  </span>
                  {/* One button that changes its act, so focus stays on it
                      when the choice is confirmed. */}
                  <ControlButton
                    data-testid={
                      on ? `risky-${id}-disable` : `risky-${id}-allow`
                    }
                    size="row"
                    variant="secondary"
                    isDisabled={disabled && busy !== id}
                    isPending={busy === id}
                    onPress={() => {
                      if (on) onChange(id, false);
                      else setAsking(id);
                    }}
                  >
                    {on ? t.disable : t.allow}
                  </ControlButton>
                </div>
              </div>
              {error === id && alert(`risky-${id}-error`, t.writeError)}
              <p className="rk-allows">
                <span>{t.allowsLabel}</span> {f.allows}
              </p>
              {on && (
                <p className="rk-since" data-testid={`risky-${id}-since`}>
                  {since(on.allowed_at)}
                </p>
              )}
            </section>
          );
        })}
      </div>
      {asking && (
        <AllowDialog
          id={asking}
          onCancel={() => setAsking(undefined)}
          onConfirm={() => {
            setAsking(undefined);
            onChange(asking, true);
          }}
        />
      )}
    </div>
  );
}
