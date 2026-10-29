import { useEffect, useState } from "react";
import { AccountKeysTable } from "../components/AccountKeys";
import { Button } from "../components/Primitives";
import {
  type AccountKey,
  accountKeysPath,
  type KeyKind,
  type AccountKeys as Keys,
  keyId,
  markSeen,
  readAccountKeys,
  seenKeys,
} from "./accountKeys";
import { jsonWrite, refusalReason, writeOutcome } from "./mutations";

/** Settings › Avaimet: the account's public keys from the person's daemon,
 * and creation of a missing default key there. */
export function AccountKeys({ csrf }: { csrf?: string }) {
  const [keys, setKeys] = useState<Keys>();
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const [created, setCreated] = useState<ReadonlySet<string>>(new Set());
  const [creating, setCreating] = useState<KeyKind>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Re-read after a session binding changes, never reuse another person's keys.
    void csrf;
    void refresh;
    const controller = new AbortController();
    setError(false);
    void fetch(accountKeysPath, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readAccountKeys)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSeen(seenKeys(data.web_identity_id, data.keys));
        setKeys(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [csrf, refresh]);
  // A key that lands while the page is open is news as much as one found
  // on opening it: read again whenever the window regains focus.
  useEffect(() => {
    const again = () => setRefresh((n) => n + 1);
    window.addEventListener("focus", again);
    return () => window.removeEventListener("focus", again);
  }, []);

  const create = async (kind: KeyKind) => {
    if (!csrf || creating) return;
    setCreating(kind);
    setNotice("");
    let response: Response | undefined;
    try {
      response = await jsonWrite(
        "account.keys",
        accountKeysPath,
        { kind },
        csrf,
      );
    } catch {
      response = undefined;
    }
    try {
      const data = await readAccountKeys(response as Response);
      // The key this request made is seen and marked; whatever the list
      // holds at that name now is judged on its own.
      if (!data.created) throw new Error("contract");
      const made = keyId(data.created);
      setSeen(markSeen(data.web_identity_id, [made]));
      setCreated((now) => new Set([...now, made]));
      setKeys(data);
    } catch {
      // A lost reply may follow a created key. Never send the creation
      // again; read what is on the account instead.
      const outcome = await writeOutcome(response?.ok ? undefined : response);
      if (outcome.kind === "refused")
        setNotice(
          outcome.code === "key_exists"
            ? "Tilillä oli jo tämä avain, eikä sitä korvattu. Avaimet luettiin uudelleen."
            : outcome.code === "key_tool_unavailable"
              ? "Tällä palvelimella ei ole ohjelmaa, joka tekee tämän avaimen."
              : outcome.code === "key_creation_running"
                ? "Toinen avaimen luonti on kesken. Odota hetki."
                : refusalReason(outcome.code, outcome.status),
        );
      else if (outcome.kind !== "login")
        setNotice(
          "Avaimen luonnin tulosta ei saatu varmistettua. Avaimet luettiin uudelleen.",
        );
      setRefresh((n) => n + 1);
    } finally {
      setCreating(undefined);
    }
  };

  const copy = async (entry: AccountKey) => {
    try {
      await navigator.clipboard.writeText(entry.public_key);
      return true;
    } catch {
      return false;
    }
  };

  if (!keys)
    return error ? (
      <div className="s-stack">
        <p role="alert" data-testid="account-keys-error">
          Avaimia ei voitu lukea. Yritä uudelleen.
        </p>
        <span>
          <Button
            data-testid="account-keys-retry"
            size="row"
            label="Yritä uudelleen"
            variant="secondary"
            onPress={() => setRefresh((n) => n + 1)}
          />
        </span>
      </div>
    ) : (
      <p className="s-desc" data-testid="account-keys-loading">
        Luetaan avaimia…
      </p>
    );
  const unseen = new Set(
    keys.keys.map(keyId).filter((id) => !seen.has(id) && !created.has(id)),
  );
  return (
    <AccountKeysTable
      keys={keys.keys}
      missing={keys.missing}
      unseen={unseen}
      created={created}
      creating={creating}
      notice={
        notice ||
        (error
          ? "Avaimia ei voitu lukea uudelleen. Näkyvissä on edellinen luku."
          : "")
      }
      onCopy={copy}
      onCreate={(kind) => void create(kind)}
      onSeen={(id) => setSeen(markSeen(keys.web_identity_id, [id]))}
    />
  );
}
