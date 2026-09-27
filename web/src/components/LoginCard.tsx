import { Button } from "./Primitives";
import { InlineNotice } from "./Status";

export function LoginCard({ onLogin }: { onLogin?: () => void }) {
  const demo = import.meta.env.VITE_SYNTHETIC_DEMO === "true";
  return (
    <section className="ah-login-card" aria-labelledby="login-title">
      <header>
        <p className="eyebrow">Omega Habitat</p>
        <h1 id="login-title">Tervetuloa Omega Habitatiin</h1>
      </header>
      <p>Kirjaudu sisään päästäksesi työtiloihisi.</p>
      <Button
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
