import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { InlineTextSetting } from "../components/InlineTextSetting";
import { ServerVersionRow } from "./ServerVersion";
import {
  type Administration,
  administration,
  changeAdministration,
} from "./serverAdministration";

import {
  bytes,
  changeStorage,
  type StorageAdministration,
  storageAdministration,
} from "./storageQuota";

// This view never receives another user's daemon route, files or credentials.
export function ServerAdministration({
  csrf,
  section = "palvelin",
  version,
  commit,
}: {
  csrf?: string;
  section?: "palvelin" | "kayttajat" | "levy";
  version?: string;
  commit?: string;
}) {
  const [editing, setEditing] = useState("");
  const [data, setData] = useState<Administration>();
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<StorageAdministration>();
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setData(await administration(signal));
  }, []);
  const reloadStorage = useCallback(async (signal?: AbortSignal) => {
    const next = await storageAdministration(signal);
    setStorage(next);
    setLimits(
      Object.fromEntries(
        next.users.map((u) => [u.id, String(u.limit_bytes / 1024 ** 3)]),
      ),
    );
    setStorageError("");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void reloadStorage(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setStorageError("Tallennustietoja ei voitu ladata.");
    });
    void reload(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setError("Ylläpitoasetuksia ei voitu ladata.");
    });
    return () => controller.abort();
  }, [reload, reloadStorage]);
  const save = async (
    change:
      | { name: string }
      | { subject: string; administrator: boolean }
      | { default_limit_bytes: number },
  ) => {
    if (!csrf || saving) return;
    setSaving(true);
    setError("");
    try {
      await changeAdministration(csrf, change);
      await reload();
      setEditing("");
    } catch {
      setError(
        "Muutosta ei voitu vahvistaa. Päivitä tiedot ennen uutta yritystä.",
      );
      // Preserve the form. A failed response can mean a lost acknowledgement;
      // reload to determine the server state before another write.
      setData(undefined);
    } finally {
      setSaving(false);
    }
  };
  // An inline field keeps its own text and failure; a write is idempotent,
  // so trying again needs no reload first.
  const saveField = async (
    change: { name: string } | { default_limit_bytes: number },
  ) => {
    if (!csrf) throw new Error("unavailable");
    await changeAdministration(csrf, change);
    await reload().catch(() => {});
  };
  const gigabytes = (raw: string): number | undefined => {
    const number = Number(raw);
    const limit = number * 1024 ** 3;
    return raw.trim() !== "" &&
      Number.isSafeInteger(limit) &&
      limit >= 1024 ** 2 &&
      limit <= 2 ** 50 &&
      limit % 1024 === 0
      ? limit
      : undefined;
  };
  const saveLimit = async (subject: string) => {
    const limit = gigabytes(limits[subject] ?? "");
    if (!csrf || limit === undefined || saving) return;
    setSaving(true);
    setStorageError("");
    try {
      await changeStorage(csrf, subject, limit);
      await reloadStorage();
    } catch {
      setStorage(undefined);
      setStorageError(
        "Muutosta ei voitu vahvistaa. Lataa tiedot uudelleen ennen uutta yritystä.",
      );
    } finally {
      setSaving(false);
    }
  };
  const bar = (used: number, limit: number) => (
    <div
      className="s-bar"
      role="img"
      aria-label={`${bytes(used)} / ${bytes(limit)}`}
    >
      <span
        style={{ width: `${limit ? Math.min(100, (100 * used) / limit) : 0}%` }}
      />
    </div>
  );
  return (
    <div className="s-card ah-administration">
      {error && (
        <div className="s-row" role="alert">
          {error}
          <ControlButton
            size="row"
            onPress={() => {
              setError("");
              void reload().catch(() =>
                setError("Ylläpitoasetuksia ei voitu ladata."),
              );
            }}
          >
            Lataa tiedot uudelleen
          </ControlButton>
        </div>
      )}
      {storageError && (
        <div className="s-row" role="alert">
          {storageError}
          <ControlButton
            size="row"
            onPress={() =>
              void reloadStorage().catch(() =>
                setStorageError("Tallennustietoja ei voitu ladata."),
              )
            }
          >
            Lataa uudelleen
          </ControlButton>
        </div>
      )}
      {data ? (
        <>
          {section === "palvelin" && (
            <InlineTextSetting
              data-testid="server-name-input"
              label="Palvelimen nimi"
              description="Näkyy kaikille sivupalkissa. Tallentuu, kun poistut kentästä."
              value={data.name}
              maxLength={80}
              disabled={!csrf}
              invalid={(draft) =>
                draft.trim() ? undefined : "nimi ei voi olla tyhjä."
              }
              onSave={(next) => saveField({ name: next })}
            />
          )}
          {section === "palvelin" && (
            <ServerVersionRow version={version} commit={commit} />
          )}
          {section === "levy" && (
            <>
              {storage && (
                <div className="s-row">
                  <div className="s-lbl">
                    <strong>Levy</strong>
                    <span className="s-desc">
                      {storage.overcommitted === null
                        ? "Kaikkia rajoja ei tiedetä. Levyn ylivarausta ei voida arvioida."
                        : storage.overcommitted
                          ? "Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä."
                          : "Kotihakemistojen levy."}
                    </span>
                  </div>
                  <div data-testid="server-storage">
                    {bytes(storage.filesystem.capacity_bytes)} yhteensä ·{" "}
                    {bytes(storage.filesystem.free_bytes)} vapaana
                    {bar(
                      storage.filesystem.capacity_bytes -
                        storage.filesystem.free_bytes,
                      storage.filesystem.capacity_bytes,
                    )}
                  </div>
                </div>
              )}
              <InlineTextSetting
                label="Oletusraja"
                description="Uusien käyttäjien raja. Ei muuta nykyisiä."
                value={String(data.default_limit_bytes / 1024 ** 3)}
                unit="GiB"
                inputMode="decimal"
                disabled={!csrf}
                normalize={(draft) => {
                  const text = draft.trim().replace(",", ".");
                  // "8,0" and "8.0" are the saved "8", not a change.
                  return gigabytes(text) === undefined
                    ? text
                    : String(Number(text));
                }}
                invalid={(draft) =>
                  gigabytes(draft.trim().replace(",", ".")) === undefined
                    ? "anna raja gigatavuina, esim. 8."
                    : undefined
                }
                onSave={(next) =>
                  saveField({ default_limit_bytes: gigabytes(next) ?? 0 })
                }
              />
            </>
          )}
          {section === "kayttajat" && (
            <>
              <p className="s-row s-desc">
                Palvelimeen sidotut GitHub-käyttäjät. Ylläpitäjä ei näe muiden
                työtiloja, keskusteluja eikä tunnuksia. Roolin muuttaminen ei
                hyväksy uusia käyttäjiä palvelimelle.
              </p>
              <table className="s-table">
                <thead>
                  <tr>
                    <th>Käyttäjä</th>
                    <th>Tallennustila</th>
                    <th>Rooli</th>
                    <th>Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => {
                    const quota = storage?.users.find(
                      (u) => u.id === user.id && !u.unavailable,
                    );
                    return (
                      <tr
                        data-testid={`administration-user-${user.username}`}
                        key={user.id}
                      >
                        <td>
                          <strong>{user.username}</strong>
                        </td>
                        <td className="s-storage">
                          {quota ? (
                            <>
                              <span className="s-storage-value">
                                {bytes(quota.usage_bytes)} /{" "}
                                {bytes(quota.limit_bytes)}
                              </span>
                              {bar(quota.usage_bytes, quota.limit_bytes)}
                            </>
                          ) : (
                            "Tilaa ei tiedetä"
                          )}
                        </td>
                        <td>
                          {user.administrator ? "Ylläpitäjä" : "Käyttäjä"}
                        </td>
                        <td>
                          <ControlButton
                            size="row"
                            isDisabled={!csrf || saving}
                            data-testid="account-role-toggle"
                            aria-pressed={user.administrator}
                            onPress={() =>
                              void save({
                                subject: user.id,
                                administrator: !user.administrator,
                              })
                            }
                          >
                            {user.administrator
                              ? "Poista ylläpitäjärooli"
                              : "Anna ylläpitäjärooli"}
                          </ControlButton>
                          {quota && (
                            <>
                              <ControlButton
                                data-testid="storage-limit-edit"
                                size="row"
                                onPress={() => setEditing(user.id)}
                              >
                                Raja…
                              </ControlButton>
                              {editing === user.id && (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void saveLimit(user.id).then(() =>
                                      setEditing(""),
                                    );
                                  }}
                                >
                                  <label className="s-field">
                                    {user.username}: raja (GiB)
                                    <input
                                      inputMode="decimal"
                                      data-testid="storage-limit-input"
                                      value={limits[user.id] ?? ""}
                                      onChange={(e) =>
                                        setLimits((v) => ({
                                          ...v,
                                          [user.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </label>
                                  <ControlButton
                                    size="row"
                                    type="submit"
                                    isDisabled={
                                      !csrf ||
                                      saving ||
                                      gigabytes(limits[user.id] ?? "") ===
                                        undefined ||
                                      gigabytes(limits[user.id] ?? "") ===
                                        quota.limit_bytes
                                    }
                                  >
                                    Tallenna raja
                                  </ControlButton>
                                  <ControlButton
                                    data-testid="cancel"
                                    size="row"
                                    onPress={() => setEditing("")}
                                  >
                                    Peruuta
                                  </ControlButton>
                                </form>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </>
      ) : (
        !error && <p className="s-row">Ladataan ylläpitoasetuksia…</p>
      )}
    </div>
  );
}
