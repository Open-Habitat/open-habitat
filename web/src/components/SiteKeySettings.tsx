import { type ReactNode, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type AIOffer,
  type KeyProvider,
  type SiteKey,
  validSiteKey,
} from "../app/onboardingConfig";
import { ControlButton, Segmented } from "./ControlElements";
import "./SiteKeySettings.css";
import { liveText } from "../i18n";
import { siteKeyText } from "../text/siteKey";

const txt = liveText(siteKeyText);

// Palvelimen ylläpito › AI-avain, the site key that Käyttöönotto's AI step
// offers (proto-admin-server-onboarding r3 "Kolme tapaa", r4; its own tab,
// Jari 24.10.2026): the key is a secret that is stored and removed at once by
// its own action, not part of the autosaved document. It is sent once and
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

/** Where the key is set, from Käyttöönotto's AI step. */
export type SiteKeyLink = { href: string; onOpen?: () => void };

export function SiteKeyPageLink({
  link,
  children,
}: {
  link?: SiteKeyLink;
  children: ReactNode;
}) {
  if (!link) return null;
  return (
    <a
      data-testid="site-key-page-link"
      href={link.href}
      onClick={(e) => {
        if (
          !link.onOpen ||
          e.button ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        link.onOpen();
      }}
    >
      {children}
    </a>
  );
}

export function SiteKeyEditor({
  siteKey,
  actions,
  onCancel,
  onRemove,
  disabled,
}: {
  siteKey?: SiteKey;
  actions?: SiteKeyActions;
  onCancel: () => void;
  /** Asks to remove the stored key. */
  onRemove?: () => void;
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
            <strong>{txt.apiKey(keyNames[siteKey.provider], false)}</strong>{" "}
            <code data-testid="site-key-suffix">
              {keyPrefix(siteKey.provider)}
              {siteKey.suffix}
            </code>
          </span>
          <span className="ob-sitekey-acts">
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
              {txt.replace}
            </ControlButton>
            {onRemove ? (
              <ControlButton
                data-testid="site-key-remove"
                size="row"
                variant="danger-subtle"
                isDisabled={disabled || !actions}
                onPress={onRemove}
              >
                {txt.remove}
              </ControlButton>
            ) : null}
          </span>
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
            label={txt.provider}
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
            <strong>{txt.apiKey(keyNames[provider], !!siteKey)}</strong>
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
                {siteKey ? txt.replaceKey : txt.useKey}
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
                {txt.cancel}
              </ControlButton>
            </span>
          </label>
          <p className="ob-muted">
            {wrong ? (
              <span role="alert" data-testid="site-key-error">
                {txt.notKey(keyNames[provider], keyPrefix(provider))}
              </span>
            ) : (
              txt.sentOnce
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
  disabled = false,
  holders,
}: {
  siteKey?: SiteKey;
  open: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Who the site has given a copy, when known: they keep it. */
  holders?: string[];
}) {
  const name = siteKey ? ` ${keyNames[siteKey.provider]}` : "";
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
          aria-label={txt.removeQuestion}
          data-testid="site-key-remove-dialog"
        >
          <Heading slot="title">{txt.removeQuestion}</Heading>
          <p>{txt.removeEffect}</p>
          <p data-testid="remove-holders">
            {holders === undefined
              ? txt.copiesStay(name)
              : holders.length > 0
                ? txt.holders(
                    holders.length,
                    holders.length < 2
                      ? holders.join("")
                      : `${holders.slice(0, -1).join(", ")}${txt.and}${holders[holders.length - 1]}`,
                    name,
                  )
                : txt.noHolders}
          </p>
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="site-key-remove-cancel"
              size="row"
              onPress={onCancel}
            >
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="site-key-remove-confirm"
              size="row"
              variant="danger-subtle"
              isDisabled={disabled}
              onPress={onConfirm}
            >
              {txt.removeKey}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The AI-avain tab: the key, its terms, and its removal. Removing it gives
 * new people every AI option again; Käyttöönotto picks another default. */
export function SiteKeyPage({
  siteKey,
  actions,
  disabled = false,
  holders,
  children,
}: {
  siteKey?: SiteKey;
  actions?: SiteKeyActions;
  disabled?: boolean;
  /** Who keeps a copy if the key is removed, when known. */
  holders?: string[];
  /** The page's own status: a refusal, an unknown outcome. */
  children?: ReactNode;
}) {
  const [removing, setRemoving] = useState(false);
  return (
    <div
      className="s-card sk-page"
      data-testid="site-key-page"
      data-settings-row="site-key"
      tabIndex={-1}
    >
      <SiteKeyEditor
        key={siteKey ? `${siteKey.provider}${siteKey.suffix}` : "new"}
        siteKey={siteKey}
        actions={actions}
        disabled={disabled}
        onCancel={() => {}}
        onRemove={() => setRemoving(true)}
      />
      {children}
      <SiteKeyRemoval
        siteKey={siteKey}
        open={removing}
        holders={holders}
        disabled={disabled || !actions}
        onCancel={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          void actions?.remove("all");
        }}
      />
    </div>
  );
}
