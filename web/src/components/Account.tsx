import { useEffect, useRef, useState } from "react";
import { NativeDisconnect } from "./NativeDisconnect";
import { GitIdentity } from "../app/GitIdentity";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Menu } from "./Overlays";
import { Button, ListRow, RadioGroup } from "./Primitives";
import { StatusMark } from "./Status";
import type { AccountProfile, PiState } from "../app/pi";

/** Provider subject numbers are not a useful person-facing name. */
export function accountLabel(displayName: string): string {
  const name = displayName.trim();
  return name && !/^GitHub user\s+\d+$/i.test(name) && !/^\d+$/.test(name)
    ? name
    : "Oma tili";
}

export function AccountIdentity({
  profile,
  compact = false,
}: {
  profile: AccountProfile;
  compact?: boolean;
}) {
  const [failedURL, setFailedURL] = useState("");
  const name = accountLabel(profile.name);
  const shown = compact && name !== "Oma tili" ? name.split(/\s+/)[0] : name;
  const avatar =
    profile.avatar_url &&
    profile.avatar_url !== failedURL &&
    /^https:\/\/avatars\.githubusercontent\.com\//.test(profile.avatar_url);
  return (
    <span className="ah-account-presentation">
      <span className="ah-account-avatar" aria-hidden="true">
        {avatar ? (
          /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load failure swaps to the textual fallback. */
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedURL(profile.avatar_url)}
          />
        ) : shown === "Oma tili" ? (
          "?"
        ) : (
          shown.slice(0, 1).toLocaleUpperCase()
        )}
      </span>
      <span className={compact ? "ah-rail-identity" : "ah-account-details"}>
        <strong>{shown}</strong>
        {!compact && profile.email && (
          <span className="ah-account-email">{profile.email}</span>
        )}
      </span>
    </span>
  );
}

function useThemeChoice() {
  const [theme, setTheme] = useState(getThemeChoice);
  useEffect(() => {
    const sync = () => setTheme(getThemeChoice());
    window.addEventListener("nah:theme-change", sync);
    return () => window.removeEventListener("nah:theme-change", sync);
  }, []);
  return theme;
}

export function AccountShelf({
  profile,
  name,
  onSettings,
  onAdministration,
  onLogout,
}: {
  profile?: AccountProfile;
  name?: string;
  onSettings: () => void;
  onAdministration?: () => void;
  onLogout: () => void;
}) {
  const theme = useThemeChoice();
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const compactName =
    accountLabel(person.name) === "Oma tili"
      ? "Oma tili"
      : accountLabel(person.name).split(/\s+/)[0];
  const themes: {
    id: ThemeChoice;
    label: string;
    icon: "system" | "sun" | "moon";
  }[] = [
    { id: "system", label: "Järjestelmä", icon: "system" },
    { id: "light", label: "Vaalea", icon: "sun" },
    { id: "dark", label: "Tumma", icon: "moon" },
  ];
  return (
    <div className="ah-account-shelf" data-account-controls>
      <Menu
        label="Tilivalikko"
        triggerLabel={`${compactName}, Tilivalikko`}
        triggerPresentation="account"
        trigger={
          <span className="ah-account-trigger">
            <AccountIdentity profile={person} compact />
          </span>
        }
        heading={<AccountIdentity profile={person} />}
        betweenItems={
          <div className="ah-account-menu-theme-row">
            <span>Teema</span>
            <fieldset className="ah-account-menu-theme" aria-label="Teema">
              {themes.map(({ id, label, icon }) => (
                <span
                  key={id}
                  className="ah-account-theme-option"
                  title={label}
                >
                  <ControlButton
                    variant="quiet"
                    size="micro"
                    type="button"
                    aria-label={label}
                    aria-pressed={theme === id}
                    onPress={() => setThemeChoice(id)}
                  >
                    <Icon name={icon} />
                  </ControlButton>
                </span>
              ))}
            </fieldset>
          </div>
        }
        popoverClassName="ah-account-menu"
        placement="top start"
        items={[
          { id: "settings", label: "Asetukset" },
          ...(onAdministration
            ? [{ id: "administration", label: "Palvelimen ylläpito" }]
            : []),
          { id: "logout", label: "Kirjaudu ulos…", danger: true },
        ]}
        onAction={(id) => {
          if (id === "settings") onSettings();
          if (id === "administration") onAdministration?.();
          if (id === "logout") onLogout();
        }}
      />
    </div>
  );
}

type NativeState =
  | "connected"
  | "disconnected"
  | "pending"
  | "partial"
  | "unknown";
const states: Record<NativeState, { label: string; description: string }> = {
  connected: {
    label: "Yhdistetty",
    description: "GitHub-yhteys toimii tällä hetkellä.",
  },
  disconnected: {
    label: "Ei yhdistetty",
    description:
      "GitHub-yhteyttä ei löytynyt. Git-toiminnot voivat vaatia uuden kirjautumisen.",
  },
  pending: {
    label: "Yhdistäminen kesken",
    description:
      "GitHub-yhteyttä valmistellaan. Odota ennen Git-toimintojen käyttöä.",
  },
  partial: {
    label: "Osittainen yhteys",
    description:
      "GitHub-yhteys ei ole vielä kokonaan valmis. Git-toiminnot eivät välttämättä onnistu.",
  },
  unknown: {
    label: "Tilaa ei tiedetä",
    description: "GitHub-yhteyden tilaa ei juuri nyt voitu vahvistaa.",
  },
};
export function AccountSettings({
  profile,
  name,
  nativeState,
  nativeLogin,
  piState = "checking",
  onPiSignIn,
  onBack,
  onLogout,
  csrf,
  onDisconnect,
}: {
  profile?: AccountProfile;
  name?: string;
  csrf?: string;
  onDisconnect?: () => void;
  nativeState?: NativeState;
  nativeLogin?: string;
  piState?: PiState | "checking" | "unavailable";
  onPiSignIn?: () => void;
  onBack: () => void;
  onLogout?: () => void;
}) {
  const theme = useThemeChoice();
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const state = states[nativeState ?? "unknown"];
  const [disconnectNotice, setDisconnectNotice] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="ah-account-settings">
      <Button
        label="Takaisin"
        variant="quiet"
        presentation="back"
        size="compact"
        onPress={onBack}
      />
      <h1 ref={heading} tabIndex={-1}>
        Asetukset
      </h1>
      <section
        className="ah-account-section"
        aria-labelledby="ah-account-heading"
      >
        <h2 id="ah-account-heading">Tili</h2>
        <div className="ah-account-identity">
          <AccountIdentity profile={person} />
        </div>
        <GitIdentity csrf={csrf} />
      </section>
      <section
        className="ah-account-section"
        aria-labelledby="ah-connections-heading"
      >
        <h2 id="ah-connections-heading">Yhteydet tällä palvelimella</h2>
        <div className="ah-account-panel">
          <div className="ah-account-connection">
            <h3>GitHub</h3>
            {nativeLogin ? (
              <code className="ah-account-login">{nativeLogin}</code>
            ) : null}
            <StatusMark
              label={state.label}
              kind={
                nativeState === "connected"
                  ? "success"
                  : nativeState === "unknown" || !nativeState
                    ? "unknown"
                    : "neutral"
              }
              tone={nativeState === "connected" ? "success" : "warning"}
            />
          </div>
          <p>{state.description}</p>
        </div>
        <p className="ah-account-hint">
          Yhteydet kuuluvat palvelimelle, eivät tähän selaimeen. Selaimesta
          uloskirjautuminen ei poista GitHub-valtuutusta.
        </p>
        {csrf && nativeState === "connected" ? (
          <NativeDisconnect
            csrf={csrf}
            onDisconnected={() => {
              setDisconnectNotice(true);
              onDisconnect?.();
            }}
          />
        ) : null}
        {disconnectNotice && nativeState !== "connected" ? (
          <p role="status">
            Paikallinen gh-valtuutus poistettu. GitHubin OAuth-lupaa ei peruttu.
          </p>
        ) : null}
        <div className="ah-account-panel">
          <div className="ah-account-connection">
            <h3>OpenAI (Pi)</h3>
            <StatusMark
              label={
                piState === "usable"
                  ? "Pi-tunnukset käytettävissä"
                  : piState === "missing"
                    ? "Pi-kirjautuminen puuttuu"
                    : piState === "checking"
                      ? "Tarkistetaan Pi-tilaa"
                      : "Pi-tilaa ei voitu vahvistaa"
              }
              kind={piState === "usable" ? "success" : "unknown"}
              tone={piState === "usable" ? "success" : "warning"}
            />
          </div>
          <p>
            {piState === "usable"
              ? "Pi:n natiivit kirjautumistiedot löytyvät tältä palvelimelta. Tämä ei vahvista OpenAI-tiliä tai yhteyden toimivuutta."
              : piState === "missing"
                ? "Pi:n natiiveja kirjautumistietoja ei löytynyt tältä palvelimelta."
                : piState === "checking"
                  ? "Tarkistetaan palvelimen Pi-kirjautumistietoja."
                  : "Palvelimen Pi-kirjautumistietojen tilaa ei tiedetä. Yhteyttä ei ole vahvistettu."}
          </p>
          {onPiSignIn ? (
            <Button
              label={
                piState === "missing"
                  ? "Kirjaudu Pi:hin"
                  : "Kirjaudu Pi:hin uudelleen"
              }
              variant="secondary"
              onPress={onPiSignIn}
            />
          ) : null}
        </div>
      </section>
      <section
        className="ah-account-section"
        aria-labelledby="ah-appearance-heading"
      >
        <h2 id="ah-appearance-heading">Ulkoasu</h2>
        <div className="ah-account-panel ah-account-theme-row">
          <ListRow
            trailing={
              <RadioGroup
                label="Teema"
                value={theme}
                options={[
                  { value: "system", label: "Järjestelmä" },
                  { value: "light", label: "Vaalea" },
                  { value: "dark", label: "Tumma" },
                ]}
                onChange={setThemeChoice}
              />
            }
          >
            <strong>Teema</strong>
            <p>Järjestelmä seuraa käyttöjärjestelmän asetusta.</p>
          </ListRow>
        </div>
      </section>
      {onLogout ? (
        <section
          className="ah-account-section"
          aria-labelledby="ah-session-heading"
        >
          <h2 id="ah-session-heading">Istunto</h2>
          <div className="ah-account-panel ah-account-session-row">
            <ListRow
              trailing={
                <Button
                  label="Kirjaudu ulos…"
                  variant="danger-subtle"
                  onPress={onLogout}
                />
              }
            >
              <strong>Kirjaudu ulos tästä selaimesta</strong>
              <p>
                Tämän selaimen luonnokset ja luettu sisältö poistetaan.
                Työtilat, palvelimen tunnukset ja agenttien työ säilyvät.
              </p>
            </ListRow>
          </div>
        </section>
      ) : null}
    </section>
  );
}

/** One confirmation for settings and the account menu; no native credential is revoked. */
export function AccountLogoutDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="ah-overlay"
      isDismissable
    >
      <Modal className="ah-modal ah-logout-modal">
        <AriaDialog
          className="ah-dialog"
          aria-label="Kirjaudutaanko ulos tästä selaimesta?"
        >
          <Heading slot="title">Kirjaudutaanko ulos tästä selaimesta?</Heading>
          <div className="ah-logout-effects">
            <div>
              <h3>Poistuu selaimesta</h3>
              <p>
                Selainistunto
                <br />
                Luonnokset
                <br />
                Luettu sisältö
              </p>
            </div>
            <div>
              <h3>Säilyy palvelimella</h3>
              <p>
                Työtilat
                <br />
                Palvelimen tunnukset
                <br />
                Agenttien käynnissä oleva työ
              </p>
            </div>
          </div>
          <div className="ah-dialog-actions">
            <Button label="Peruuta" variant="secondary" onPress={onClose} />
            <Button
              label="Kirjaudu ulos"
              variant="danger"
              onPress={onConfirm}
            />
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
