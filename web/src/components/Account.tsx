import { useEffect, useRef, useState } from "react";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { Menu } from "./Overlays";
import { Button } from "./Primitives";
import { InlineNotice, StatusMark } from "./Status";

/** Provider subject numbers are not a useful person-facing name. */
export function accountLabel(displayName: string): string {
  const name = displayName.trim();
  return name && !/^GitHub user\s+\d+$/i.test(name) && !/^\d+$/.test(name)
    ? name
    : "Oma tili";
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
  const [theme, setTheme] = useState(getThemeChoice);
  const themes: { id: ThemeChoice; label: string }[] = [
    { id: "system", label: "Järjestelmä" },
    { id: "light", label: "Vaalea" },
    { id: "dark", label: "Tumma" },
  ];
  return (
    <div className="ah-account-shelf" data-account-controls>
      <span className="ah-rail-identity" title={name}>
        {name}
      </span>
      <Menu
        label="Tilivalikko"
        items={[
          { id: "settings", label: "Asetukset" },
          ...themes.map(({ id, label }) => ({
            id: `theme-${id}`,
            label: `Teema: ${label}${theme === id ? " (valittu)" : ""}`,
          })),
          { id: "logout", label: "Kirjaudu ulos" },
        ]}
        onAction={(id) => {
          if (id.startsWith("theme-")) {
            const choice = id.slice(6) as ThemeChoice;
            setThemeChoice(choice);
            setTheme(choice);
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
}: {
  name: string;
  nativeState?: NativeState;
  onBack: () => void;
}) {
  const state = states[nativeState ?? "unknown"];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="ah-account-settings">
      <Button
        label="Takaisin"
        variant="quiet"
        size="compact"
        onPress={onBack}
      />
      <h1 ref={heading} tabIndex={-1}>
        Asetukset
      </h1>
      <p>Tili: {name}</p>
      <section aria-labelledby="ah-github-heading" className="ah-account-panel">
        <h2 id="ah-github-heading">GitHub</h2>
        <p>
          Yhteys tällä palvelimella{" "}
          <StatusMark
            label={state.label}
            tone={nativeState === "connected" ? "success" : "warning"}
          />
        </p>
        <p>{state.description}</p>
        <InlineNotice
          title="Yhteyttä ei voi vielä katkaista täällä"
          description="Uloskirjautuminen sulkee selaimen istunnon, mutta ei poista tämän palvelimen GitHub-kirjautumista."
        />
      </section>
    </section>
  );
}
