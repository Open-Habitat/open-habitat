import { Button } from "./Primitives";
export function LoginCard({ onLogin }: { onLogin?: () => void }) {
  return (
    <section className="card" aria-labelledby="login-title">
      <p className="eyebrow">NATIVE AGENT HOST · {window.location.host}</p>
      <h1 id="login-title">Kirjaudu jatkaaksesi</h1>
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
