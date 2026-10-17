import type { ReactNode } from "react";
import { OnboardingFrame } from "./OnboardingFrame";
import { Button } from "./Primitives";
import { InlineNotice } from "./Status";

export function LoginCard({
  onLogin,
  notice,
}: {
  onLogin?: () => void;
  notice?: ReactNode;
}) {
  const demo = import.meta.env.VITE_SYNTHETIC_DEMO === "true";
  return (
    <OnboardingFrame step={1} notice={notice}>
      <section className="ah-login-card" aria-labelledby="login-title">
        <header>
          <p className="eyebrow">Open Habitat</p>
          <h1 id="login-title">Tervetuloa Open Habitatiin</h1>
        </header>
        <p>
          Kirjaudu GitHub-tililläsi. Pääset omiin työtiloihisi ja voit
          työskennellä niissä agenttien kanssa. Kirjautumisen jälkeen voit
          valita työtilasi ja yhdistää OpenAI-tilisi.
        </p>
        <Button
          size="page"
          label="Kirjaudu GitHubilla"
          availability={
            demo
              ? {
                  state: "unsupported",
                  reason: "Simuloidussa demossa ei voi kirjautua.",
                }
              : undefined
          }
          onPress={
            onLogin ??
            (() => {
              window.location.href = "/auth/github/start";
            })
          }
        />
        {demo ? <p className="muted">Tämä näkymä on simulaatio.</p> : null}
      </section>
    </OnboardingFrame>
  );
}

// The callback currently supplies only a URL error code, not an authenticated,
// user-safe support reference. Never echo that query value as a diagnostic.
export function LoginErrorNotice() {
  return (
    <InlineNotice
      title="Kirjautumisessa tapahtui virhe"
      description="Yritä kirjautua uudelleen. Jos virhe toistuu, ota yhteyttä palvelun ylläpitäjään. Älä lähetä tunnuksia tai kirjautumislinkkejä."
      tone="danger"
    />
  );
}
