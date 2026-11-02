import { useEffect, useState } from "react";
import schema from "../../../contracts/v1/git-identity.schema.json";
import { ControlButton } from "../components/ControlElements";
import { Button } from "../components/Primitives";
import { liveText } from "../i18n";
import { gitIdentityText } from "../text/gitIdentity";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch, refusalReason, writeOutcome } from "./mutations";

const txt = liveText(gitIdentityText);

const valid = new LazyAjv({ strict: false }).compile(schema);
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
  preferredName = "",
  preferredEmail = "",
  onContinue,
}: {
  csrf?: string;
  onboarding?: boolean;
  preferredName?: string;
  preferredEmail?: string;
  onContinue?: () => void;
}) {
  const [identity, setIdentity] = useState<Identity>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Why the last confirmation did not go through. It outlives the re-read
  // that follows, so a failed click never looks like nothing happened.
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    void csrf;
    setNotice("");
  }, [csrf]);
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
        setName(data.name || preferredName || data.suggested_name);
        setEmail(data.email || preferredEmail || data.suggested_email);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(txt.readError);
      });
    return () => controller.abort();
  }, [csrf, refresh, preferredName, preferredEmail]);
  const existing = Boolean(identity?.name || identity?.email);
  const save = async () => {
    if (!csrf || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    let r: Response | undefined;
    try {
      r = await mutationFetch("git.identity", path, {
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
    } catch {
      r = undefined;
    }
    try {
      if (!r?.ok) throw new Error("write");
      const data: unknown = await r.json();
      if (!valid(data)) throw new Error("contract");
      setIdentity(data as Identity);
      setEditing(false);
      if (onboarding) onContinue?.();
    } catch {
      // A lost response may follow a completed write. Observe Git instead of
      // retrying the POST, which would be a second native mutation. An
      // existing identity needs no words: the re-read shows it.
      const outcome = await writeOutcome(r?.ok ? undefined : r);
      if (outcome.kind === "refused" && outcome.code !== "identity_exists")
        setNotice(refusalReason(outcome.code, outcome.status));
      else if (outcome.kind !== "refused") setNotice(txt.uncertain);
      setRefresh((old) => old + 1);
    } finally {
      setBusy(false);
    }
  };
  const retry = (
    <Button
      data-testid="git-identity-retry"
      size="row"
      label={txt.retry}
      onPress={() => setRefresh((old) => old + 1)}
    />
  );
  if (!onboarding)
    return (
      <section
        data-testid="git-identity"
        className="s-row"
        data-settings-row="git-identity"
        tabIndex={-1}
        aria-label={txt.label}
      >
        <div className="s-lbl">
          <strong>{txt.label}</strong>
          <span className="s-desc">
            {txt.descBefore} <code>~/.gitconfig</code>
            {txt.descAfter}
          </span>
        </div>
        <div className="s-val">
          {identity ? (
            <>
              <span className="s-lbl">
                <strong data-testid="git-identity-name">
                  {identity.name || txt.nameMissing}
                </strong>
                <span className="s-desc">
                  {identity.email || txt.emailMissing}
                </span>
              </span>
              <ControlButton
                data-testid="git-identity-edit"
                size="row"
                onPress={() => setEditing(true)}
              >
                {txt.edit}
              </ControlButton>
            </>
          ) : error ? (
            retry
          ) : (
            txt.checking
          )}
        </div>
        {(error || notice) && (
          <p className="s-editor" role="alert" data-testid="git-identity-error">
            {error || notice}
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
              {txt.nameField}
              <input
                data-testid="git-name-input"
                autoComplete="name"
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="s-field">
              {txt.emailField}
              <input
                data-testid="git-email-input"
                type="email"
                autoComplete="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="s-actions">
              <ControlButton
                data-testid="cancel"
                size="row"
                onPress={() => {
                  setName(identity.name || identity.suggested_name);
                  setEmail(identity.email || identity.suggested_email);
                  setEditing(false);
                }}
              >
                {txt.cancel}
              </ControlButton>
              <ControlButton
                data-testid="git-identity-save"
                size="row"
                type="submit"
                isDisabled={busy || !csrf || !name.trim() || !email}
              >
                {txt.save}
              </ControlButton>
            </div>
          </form>
        )}
      </section>
    );
  return (
    <section
      data-testid="git-identity"
      className="ah-account-panel"
      aria-label={txt.label}
    >
      <h3>{txt.label}</h3>
      {(error || notice) && (
        <p role="alert" data-testid="git-identity-error">
          {error || notice}
        </p>
      )}
      {!identity ? (
        <p>{error ? retry : txt.checking}</p>
      ) : !existing && identity.emails.length === 0 ? (
        <>
          <p role="alert">{txt.noSuggestions}</p>
          {retry}
        </>
      ) : existing ? (
        <>
          <p>
            <strong data-testid="git-identity-name">
              {identity.name || txt.nameMissing}
            </strong>{" "}
            · {identity.email || txt.emailMissing}
            <br />
            {txt.source}{" "}
            <code>
              {identity.source === "Gitin globaali asetus"
                ? txt.globalSetting
                : identity.source}
            </code>
          </p>
          <Button
            data-testid="git-identity-continue"
            size="page"
            label={txt.continue}
            onPress={() => onContinue?.()}
          />
        </>
      ) : (
        <>
          <label>
            {txt.nameInGit}{" "}
            <input
              data-testid="git-name-input"
              autoComplete="name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label htmlFor="git-identity-email">
            {txt.emailInGit}{" "}
            <select
              id="git-identity-email"
              data-testid="git-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            >
              {[
                ...new Set(
                  [preferredEmail, ...identity.emails].filter(Boolean),
                ),
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="page"
            label={busy ? txt.saving : txt.confirm}
            data-testid="git-identity-confirm"
            availability={
              busy || !name.trim() || !email
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
