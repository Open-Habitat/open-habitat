import { useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type AIOffer,
  type KeyProvider,
  type SiteKey,
  validSiteKey,
} from "../app/onboardingConfig";
import { ControlButton, Segmented } from "./ControlElements";

// Käyttöönotto › AI-tili › Sivuston avain (proto-admin-server-onboarding r3
// "Kolme tapaa", r4): the key is a secret that is stored and removed at once
// by its own action, not part of the autosaved document. It is sent once and
// only its provider and last four characters come back.

export const keyNames: Record<KeyProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
};
const keyPrefix = (p: KeyProvider) => (p === "anthropic" ? "sk-ant-…" : "sk-…");

/** What the page does with the key: each resolves true once the host has
 * confirmed it, false when it refused or the outcome is unknown. */
export type SiteKeyActions = {
  set: (provider: KeyProvider, key: string) => Promise<boolean>;
  /** Removes the key; offer is what new people get instead. */
  remove: (offer: Exclude<AIOffer, "site_key">) => Promise<boolean>;
};

export function SiteKeyEditor({
  siteKey,
  actions,
  onCancel,
  disabled,
}: {
  siteKey?: SiteKey;
  actions?: SiteKeyActions;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(!siteKey);
  const [provider, setProvider] = useState<KeyProvider>(
    siteKey?.provider ?? "openai",
  );
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const fits = validSiteKey(provider, key);
  const wrong = key !== "" && !fits;
  const save = async () => {
    if (!fits || !actions || busy) return;
    setBusy(true);
    const stored = await actions.set(provider, key);
    setBusy(false);
    // The key stays in the field only until the host has it, or refused it.
    setKey("");
    if (stored) setEditing(false);
  };
  return (
    <div className="ob-sitekey" data-testid="site-key">
      {siteKey && !editing ? (
        <div className="ob-sitekey-row" data-testid="site-key-present">
          <span>
            <strong>{keyNames[siteKey.provider]} API-avain</strong>{" "}
            <code data-testid="site-key-suffix">
              {keyPrefix(siteKey.provider)}
              {siteKey.suffix}
            </code>
          </span>
          <ControlButton
            data-testid="site-key-replace"
            size="row"
            variant="secondary"
            isDisabled={disabled || !actions}
            onPress={() => {
              setProvider(siteKey.provider);
              setEditing(true);
            }}
          >
            Vaihda avain…
          </ControlButton>
        </div>
      ) : null}
      {editing ? (
        <form
          className="ob-sitekey-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Segmented
            data-testid="site-key-provider"
            label="Avaimen palvelu"
            size="row"
            isDisabled={disabled || busy}
            options={(Object.keys(keyNames) as KeyProvider[]).map((p) => ({
              id: p,
              label: keyNames[p],
            }))}
            value={provider}
            onChange={setProvider}
          />
          <label className="ah-key-embedded-field">
            <strong>
              {siteKey ? "Uusi " : ""}
              {keyNames[provider]} API-avain
            </strong>
            <span className="ah-inline-field">
              <input
                data-testid="site-key-input"
                type="password"
                autoComplete="off"
                value={key}
                maxLength={203}
                placeholder={keyPrefix(provider)}
                aria-invalid={wrong || undefined}
                disabled={disabled || busy}
                onChange={(e) => setKey(e.target.value)}
              />
              <ControlButton
                data-testid="site-key-save"
                size="row"
                variant="primary"
                type="submit"
                isDisabled={disabled || busy || !fits || !actions}
              >
                {siteKey ? "Vaihda avain" : "Ota avain käyttöön"}
              </ControlButton>
              <ControlButton
                data-testid="site-key-cancel"
                size="row"
                variant="quiet"
                isDisabled={busy}
                onPress={() => {
                  setKey("");
                  if (siteKey) setEditing(false);
                  else onCancel();
                }}
              >
                Peruuta
              </ControlButton>
            </span>
          </label>
          <p className="ob-muted">
            {wrong ? (
              <span role="alert" data-testid="site-key-error">
                Tämä ei näytä {keyNames[provider]}-avaimelta (
                {keyPrefix(provider)}).
              </span>
            ) : (
              "Avain lähetetään kerran eikä sitä näytetä uudelleen."
            )}
          </p>
        </form>
      ) : null}
    </div>
  );
}

/** Asks before the key goes: switching to another way removes it. */
export function SiteKeyRemoval({
  siteKey,
  open,
  onCancel,
  onConfirm,
}: {
  siteKey?: SiteKey;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen={open}
      isDismissable
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <Modal className="ah-modal">
        <Dialog
          className="ah-dialog"
          aria-label="Poistetaanko sivuston avain?"
          data-testid="site-key-remove-dialog"
        >
          <Heading slot="title">Poistetaanko sivuston avain?</Heading>
          <p>
            Uudet henkilöt valitsevat AI-tilin taas itse. Jo jaetut kopiot
            jäävät. Niiden käytön estää vain avaimen mitätöinti palvelussa
            {siteKey ? ` ${keyNames[siteKey.provider]}` : ""}.
          </p>
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="site-key-remove-cancel"
              size="row"
              onPress={onCancel}
            >
              Peruuta
            </ControlButton>
            <ControlButton
              data-testid="site-key-remove-confirm"
              size="row"
              variant="danger-subtle"
              onPress={onConfirm}
            >
              Poista avain
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
