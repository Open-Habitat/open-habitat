import Ajv from "ajv/dist/2020.js";
import { useEffect, useState } from "react";
import schema from "../../../contracts/v1/git-identity.schema.json";
import { ControlButton } from "../components/ControlElements";
import { Button } from "../components/Primitives";
import { mutationFetch } from "./mutations";

const valid = new Ajv({ strict: false }).compile(schema);
type Identity = {
  schema_version: 1;
  name: string;
  email: string;
  source: "~/.gitconfig" | "~/.config/git/config" | "Gitin globaali asetus";
  suggested_name: string;
  suggested_email: string;
  emails: string[];
};
const path = "/api/v1/account/git-identity";

export function GitIdentity({
  csrf,
  onboarding = false,
  onContinue,
}: {
  csrf?: string;
  onboarding?: boolean;
  onContinue?: () => void;
}) {
  const [identity, setIdentity] = useState<Identity>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    // Re-read after a session binding changes, never reuse another person's values.
    void csrf;
    void refresh;
    const controller = new AbortController();
    setIdentity(undefined);
    setError("");
    void fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("read");
        const data: unknown = await r.json();
        if (!valid(data)) throw new Error("contract");
        return data as Identity;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setIdentity(data);
        setName(data.name || data.suggested_name);
        setEmail(data.email || data.suggested_email);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Git-identiteettiä ei voitu tarkistaa. Yritä uudelleen.");
      });
    return () => controller.abort();
  }, [csrf, refresh]);
  const existing = Boolean(identity?.name || identity?.email);
  const save = async () => {
    if (!csrf || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await mutationFetch("git.identity", path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({
          name,
          email,
          mode: onboarding ? "onboarding" : "settings",
        }),
      });
      if (!r.ok) throw new Error("write");
      const data: unknown = await r.json();
      if (!valid(data)) throw new Error("contract");
      setIdentity(data as Identity);
      setEditing(false);
      if (onboarding) onContinue?.();
    } catch {
      // A lost response may follow a completed write. Observe Git instead of
      // retrying the POST, which would be a second native mutation.
      setRefresh((old) => old + 1);
    } finally {
      setBusy(false);
    }
  };
  const retry = (
    <Button
      size="row"
      label="Yritä uudelleen"
      onPress={() => setRefresh((old) => old + 1)}
    />
  );
  if (!onboarding)
    return (
      <section className="s-row" aria-label="Git-identiteetti">
        <div className="s-lbl">
          <strong>Git-identiteetti</strong>
          <span className="s-desc">
            Commitien tekijä. Tallentuu globaaliin <code>~/.gitconfig</code>
            -tiedostoon.
          </span>
        </div>
        <div className="s-val">
          {identity ? (
            <>
              <span className="s-lbl">
                <strong>{identity.name || "Nimi puuttuu"}</strong>
                <span className="s-desc">
                  {identity.email || "Sähköposti puuttuu"}
                </span>
              </span>
              <ControlButton size="row" onPress={() => setEditing(true)}>
                Muokkaa Git-identiteettiä
              </ControlButton>
            </>
          ) : error ? (
            retry
          ) : (
            "Tarkistetaan Git-asetukset…"
          )}
        </div>
        {error && (
          <p className="s-editor" role="alert">
            {error}
          </p>
        )}
        {editing && identity && (
          <form
            className="s-editor"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="s-field">
              Gitissä näkyvä nimi
              <input
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="s-field">
              Gitissä näkyvä sähköposti
              <input
                type="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="s-actions">
              <ControlButton
                size="row"
                onPress={() => {
                  setName(identity.name || identity.suggested_name);
                  setEmail(identity.email || identity.suggested_email);
                  setEditing(false);
                }}
              >
                Peruuta
              </ControlButton>
              <ControlButton
                size="row"
                type="submit"
                isDisabled={busy || !csrf || !name.trim() || !email}
              >
                Tallenna Git-identiteetti
              </ControlButton>
            </div>
          </form>
        )}
      </section>
    );
  return (
    <section className="ah-account-panel" aria-label="Git-identiteetti">
      <h3>Git-identiteetti</h3>
      {error && <p role="alert">{error}</p>}
      {!identity ? (
        <p>{error ? retry : "Tarkistetaan Git-asetukset…"}</p>
      ) : !existing && identity.emails.length === 0 ? (
        <>
          <p role="alert">GitHub-ehdotuksia ei saatu. Yritä uudelleen.</p>
          {retry}
        </>
      ) : existing ? (
        <>
          <p>
            <strong>{identity.name || "Nimi puuttuu"}</strong> ·{" "}
            {identity.email || "Sähköposti puuttuu"}
            <br />
            Lähde: <code>{identity.source}</code>
          </p>
          <Button
            size="page"
            label="Jatka repoihin"
            onPress={() => onContinue?.()}
          />
        </>
      ) : (
        <>
          <label>
            Gitissä näkyvä nimi{" "}
            <input
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label htmlFor="git-identity-email">
            Gitissä näkyvä sähköposti{" "}
            <select
              id="git-identity-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            >
              {identity.emails.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="page"
            label={busy ? "Tallennetaan…" : "Vahvista Git-identiteetti"}
            availability={
              busy || !name.trim() || !email || !identity.emails.includes(email)
                ? { state: "disabled", reason: "" }
                : { state: "enabled" }
            }
            onPress={() => void save()}
          />
        </>
      )}
    </section>
  );
}
