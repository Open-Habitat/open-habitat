import { useState, type FormEvent } from "react";
import type { AccountProfile } from "./pi";

export function AccountProfileOnboarding({
  profile,
  csrf,
  onSaved,
  onLogin,
}: {
  profile: AccountProfile;
  csrf?: string;
  onSaved: (profile: AccountProfile) => void;
  onLogin: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!csrf || pending) return;
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/auth/profile", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (response.status === 401) {
        onLogin();
        return;
      }
      if (!response.ok) throw new Error("profile unavailable");
      const saved: AccountProfile = await response.json();
      onSaved(saved);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="ah-account-onboarding">
      <h1>Täydennä tilisi tiedot</h1>
      <p>
        GitHub ei antanut kaikkia näyttötietoja. Nämä tiedot näkyvät vain tilisi
        esityksessä eivätkä muuta kirjautumista.
      </p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        {!profile.name && (
          <label>
            Nimi{" "}
            <input
              required
              maxLength={200}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}
        {!profile.email && (
          <label>
            Sähköposti{" "}
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}
        {error && (
          <p role="alert">
            Tietoja ei voitu tallentaa. Tarkista tiedot ja yritä uudelleen.
          </p>
        )}
        <button type="submit" disabled={pending || !csrf}>
          {pending ? "Tallennetaan…" : "Jatka"}
        </button>
      </form>
    </main>
  );
}
