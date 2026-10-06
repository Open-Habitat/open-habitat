import { useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { Menu } from "./Overlays";
import { Button, ListRow, RadioGroup } from "./Primitives";
import { StatusMark } from "./Status";

/** Provider subject numbers are not a useful person-facing name. */
export function accountLabel(displayName: string): string {
  const name = displayName.trim();
  return name && !/^GitHub user\s+\d+$/i.test(name) && !/^\d+$/.test(name)
    ? name
    : "Oma tili";
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
  name,
  onSettings,
  onLogout,
}: {
  name: string;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const theme = useThemeChoice();
  const compactName =
    accountLabel(name) === "Oma tili"
      ? "Oma tili"
      : accountLabel(name).split(/\s+/)[0];
  const initial =
    compactName === "Oma tili"
      ? "?"
      : compactName.slice(0, 1).toLocaleUpperCase();
  const themes: { id: ThemeChoice; label: string }[] = [
    { id: "system", label: "Järjestelmä" },
    { id: "light", label: "Vaalea" },
    { id: "dark", label: "Tumma" },
  ];
  return (
    <div className="ah-account-shelf" data-account-controls>
      <Menu
        label="Tilivalikko"
        triggerLabel={`${compactName}, Tilivalikko`}
        triggerPresentation="account"
        trigger={
          <span className="ah-account-trigger">
            <span className="ah-account-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="ah-rail-identity">{compactName}</span>
          </span>
        }
        heading={<strong>{accountLabel(name)}</strong>}
        popoverClassName="ah-account-menu"
        items={[
          { id: "settings", label: "Asetukset" },
          ...themes.map(({ id, label }) => ({
            id: `theme-${id}`,
            label: `Teema: ${label}${theme === id ? " (valittu)" : ""}`,
            selected: theme === id,
            group: "theme",
            displayLabel: label,
          })),
          { id: "logout", label: "Kirjaudu ulos…", danger: true },
        ]}
        onAction={(id) => {
          if (id.startsWith("theme-")) {
            const choice = id.slice(6) as ThemeChoice;
            setThemeChoice(choice);
          }
          if (id === "settings") onSettings();
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
  name,
  nativeState,
  nativeLogin,
  onBack,
  onLogout,
}: {
  name: string;
  nativeState?: NativeState;
  nativeLogin?: string;
  onBack: () => void;
  onLogout?: () => void;
}) {
  const theme = useThemeChoice();
  const state = states[nativeState ?? "unknown"];
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
          <span className="ah-account-avatar" aria-hidden="true">
            {accountLabel(name) === "Oma tili"
              ? "?"
              : name.trim().slice(0, 1).toLocaleUpperCase()}
          </span>
          <strong className="ah-account-full-name">{accountLabel(name)}</strong>
          {accountLabel(name) !== "Oma tili" ? (
            <span className="ah-account-origin">GitHubista</span>
          ) : null}
        </div>
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
          Yhteydet kuuluvat palvelimelle, eivät tähän selaimeen. Yhteyttä ei voi
          vielä katkaista täällä.
        </p>
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
