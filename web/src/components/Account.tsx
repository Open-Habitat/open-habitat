import { useEffect, useRef } from "react";
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
  return (
    <div className="ah-account-shelf">
      <span className="ah-rail-identity" title={name}>
        {name}
      </span>
      <Menu
        label="Tilivalikko"
        items={[
          { id: "settings", label: "Asetukset" },
          { id: "logout", label: "Kirjaudu ulos" },
        ]}
        onAction={(id) => {
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
    description: "Natiivi GitHub-yhteys on vahvistettu tässä tilannekuvassa.",
  },
  disconnected: {
    label: "Ei yhdistetty",
    description: "Natiivia GitHub-yhteyttä ei havaittu.",
  },
  pending: {
    label: "Yhdistäminen kesken",
    description:
      "Natiivin GitHub-yhteyden asennus on kesken. Git-toimintoja ei voi vielä olettaa valmiiksi.",
  },
  partial: {
    label: "Osittainen yhteys",
    description:
      "Asennus onnistui vain osittain. Git-toimintoja ei voi olettaa valmiiksi.",
  },
  unknown: {
    label: "Tilaa ei tiedetä",
    description:
      "Natiivin GitHub-yhteyden tilaa ei ole vahvistettu tässä havainnossa.",
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
          Natiivi yhteys{" "}
          <StatusMark
            label={state.label}
            tone={nativeState === "connected" ? "success" : "warning"}
          />
        </p>
        <p>{state.description}</p>
        <Button
          label="Katkaise natiivi GitHub-yhteys"
          availability={{
            state: "disabled",
            reason:
              "Katkaisu ei ole käytettävissä: vahvistettu palvelintoiminto ja uudelleentunnistautuminen puuttuvat.",
          }}
          onPress={() => {}}
        />
        <InlineNotice
          title="Web-istunto ja natiivi yhteys ovat erillisiä"
          description="Web-uloskirjautuminen ei katkaise natiivia GitHub-yhteyttä. Katkaisua ei voi vielä tehdä täällä."
        />
      </section>
    </section>
  );
}
