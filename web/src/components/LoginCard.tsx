import { Button } from "./Button";
export function LoginCard() {
  return (
    <section className="card" aria-labelledby="login-title">
      <p className="eyebrow">ALDER · NATIVE AGENT HOST</p>
      <h1 id="login-title">Kirjaudu jatkaaksesi</h1>
      <p>
        Selain ei valitse Linux-käyttäjää. Palvelin reitittää hyväksytyn
        verkkoidentiteetin oikealle käyttäjälle.
      </p>
      <Button
        label="Kirjaudu GitHubilla"
        onPress={() => {
          window.location.href = "/auth/github/start";
        }}
      />
      <p className="muted">
        Google näkyy vasta, jos ylläpitäjä määrittää sen erikseen.
      </p>
    </section>
  );
}
