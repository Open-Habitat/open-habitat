import { Button } from "./Primitives";
export function LoginCard({ onLogin }: { onLogin?: () => void }) {
  const demo = import.meta.env.VITE_SYNTHETIC_DEMO === "true";
  return (
    <section className="ah-login-card" aria-labelledby="login-title">
      <header>
        <p className="eyebrow">Native Agent Host</p>
        <h1 id="login-title">Kirjaudu jatkaaksesi</h1>
        <p className="ah-technical ah-login-host">{window.location.host}</p>
      </header>
      <p>
        {demo
          ? "Tämä on vain kirjautumisnäkymän simulaatio. Istuntoa tai Unix-käyttäjää ei luoda."
          : "Selain ei valitse Unix-käyttäjää. Palvelin reitittää hyväksytyn verkkoidentiteetin sille määritettyyn tiliin."}
      </p>
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
      <p className="muted">
        {demo
          ? "Valitse valmis tila avaamalla ?scenario=ready osoitteessa /workspaces."
          : "Kirjautuminen jatkuu GitHubissa. Istunto alkaa vasta onnistuneen paluun ja natiivin yhteyden vahvistuksen jälkeen."}
      </p>
    </section>
  );
}
