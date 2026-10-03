import { useEffect, useRef, useState } from "react";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { Menu } from "./Overlays";
import { Button, RadioGroup } from "./Primitives";
import { InlineNotice, StatusMark } from "./Status";

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
  const themes: { id: ThemeChoice; label: string }[] = [
    { id: "system", label: "Järjestelmä" },
    { id: "light", label: "Vaalea" },
    { id: "dark", label: "Tumma" },
  ];
  return (
    <div className="ah-account-shelf" data-account-controls>
      <Menu
        label="Tilivalikko"
        triggerLabel={`${name}, Tilivalikko`}
        triggerPresentation="account"
        trigger={
          <span className="ah-account-trigger">
            <span className="ah-account-avatar" aria-hidden="true" />
            <span className="ah-rail-identity">{name}</span>
          </span>
        }
        heading={<strong>{name}</strong>}
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
          { id: "logout", label: "Kirjaudu ulos", danger: true },
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
  onBack,
  onLogout,
}: {
  name: string;
  nativeState?: NativeState;
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
          <span className="ah-account-avatar" aria-hidden="true" />
          <strong>{name}</strong>
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
        <InlineNotice
          title="Yhteyttä ei voi vielä katkaista täällä"
          description="Uloskirjautuminen sulkee selaimen istunnon, mutta ei poista tämän palvelimen GitHub-kirjautumista."
        />
      </section>
      <section
        className="ah-account-section"
        aria-labelledby="ah-appearance-heading"
      >
        <h2 id="ah-appearance-heading">Ulkoasu</h2>
        <div className="ah-account-panel ah-account-theme-row">
          <div>
            <strong>Teema</strong>
            <p>Järjestelmä seuraa käyttöjärjestelmän asetusta.</p>
          </div>
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
        </div>
      </section>
      {onLogout ? (
        <section
          className="ah-account-section"
          aria-labelledby="ah-session-heading"
        >
          <h2 id="ah-session-heading">Istunto</h2>
          <div className="ah-account-panel ah-account-session-row">
            <div>
              <strong>Kirjaudu ulos tästä selaimesta</strong>
              <p>
                Kirjautuminen ulos sulkee vain tämän selaimen istunnon.
                Agenttien työ palvelimella jatkuu.
              </p>
            </div>
            <Button
              label="Kirjaudu ulos"
              variant="danger-subtle"
              onPress={onLogout}
            />
          </div>
        </section>
      ) : null}
    </section>
  );
}
