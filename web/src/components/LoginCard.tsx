import { Button } from "./Primitives";
export function LoginCard({ onLogin }: { onLogin?: () => void }) {
  return (
    <section className="ah-login-card" aria-labelledby="login-title">
      <header>
        <p className="eyebrow">Native Agent Host</p>
        <h1 id="login-title">Kirjaudu jatkaaksesi</h1>
        <p className="ah-technical ah-login-host">{window.location.host}</p>
      </header>
      <p>
        Selain ei valitse Unix-käyttäjää. Palvelin reitittää hyväksytyn
        verkkoidentiteetin sille määritettyyn tiliin.
      </p>
      <Button
        label="Kirjaudu GitHubilla"
        onPress={
          onLogin ??
          (() => {
            window.location.href = "/auth/github/start";
          })
        }
      />
      <p className="muted">
        Kirjautuminen jatkuu GitHubissa. Istunto alkaa vasta onnistuneen paluun
        ja natiivin yhteyden vahvistuksen jälkeen.
      </p>
    </section>
  );
}
