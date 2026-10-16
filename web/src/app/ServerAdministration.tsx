import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
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
}: {
  csrf?: string;
  section?: "palvelin" | "kayttajat" | "levy";
}) {
  const [editing, setEditing] = useState("");
  const [data, setData] = useState<Administration>();
  const [name, setName] = useState("");
  const [defaultGiB, setDefaultGiB] = useState("");
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<StorageAdministration>();
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const reload = useCallback(
    async (signal?: AbortSignal, preserveDraft = false) => {
      const next = await administration(signal);
      setData(next);
      if (!preserveDraft) {
        setName(next.name);
        setDefaultGiB(
          next.default_limit_bytes
            ? String(next.default_limit_bytes / 1024 ** 3)
            : "",
        );
      }
    },
    [],
  );
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
            onPress={() => {
              setError("");
              void reload(undefined, true).catch(() =>
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
            <div className="s-row">
              <div className="s-lbl">
                <strong>Palvelimen nimi</strong>
                <span className="s-desc">Näkyy kaikille sivupalkissa.</span>
              </div>
              <div className="s-val">
                {data.name}
                <ControlButton onPress={() => setEditing("name")}>
                  Muokkaa
                </ControlButton>
              </div>
              {editing === "name" && (
                <form
                  className="s-editor"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save({ name: name.trim() });
                  }}
                >
                  <label className="s-field">
                    Palvelimen nimi
                    <input
                      value={name}
                      maxLength={80}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <div className="s-actions">
                    <ControlButton onPress={() => setEditing("")}>
                      Peruuta
                    </ControlButton>
                    <ControlButton
                      type="submit"
                      isDisabled={
                        !csrf ||
                        saving ||
                        !name.trim() ||
                        name.trim() === data.name
                      }
                    >
                      Tallenna nimi
                    </ControlButton>
                  </div>
                </form>
              )}
            </div>
          )}
          {section === "levy" && (
            <>
              {storage && (
                <div className="s-row">
                  <div className="s-lbl">
                    <strong>Levy</strong>
                    <span className="s-desc">
                      {storage.overcommitted
                        ? "Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä."
                        : "Kotihakemistojen levy."}
                    </span>
                  </div>
                  <div>
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
              <div className="s-row">
                <div className="s-lbl">
                  <strong>Oletusraja</strong>
                  <span className="s-desc">
                    Uusien käyttäjien raja. Ei muuta nykyisiä.
                  </span>
                </div>
                <div className="s-val">
                  {bytes(data.default_limit_bytes)}
                  <ControlButton onPress={() => setEditing("default")}>
                    Muuta
                  </ControlButton>
                </div>
                {editing === "default" && (
                  <form
                    className="s-editor"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const limit = gigabytes(defaultGiB);
                      if (limit !== undefined)
                        void save({ default_limit_bytes: limit }).then(() =>
                          setEditing(""),
                        );
                    }}
                  >
                    <label className="s-field">
                      Oletusraja (GiB)
                      <input
                        inputMode="decimal"
                        value={defaultGiB}
                        onChange={(e) => setDefaultGiB(e.target.value)}
                      />
                    </label>
                    <div className="s-actions">
                      <ControlButton onPress={() => setEditing("")}>
                        Peruuta
                      </ControlButton>
                      <ControlButton
                        type="submit"
                        isDisabled={
                          !csrf ||
                          saving ||
                          gigabytes(defaultGiB) === undefined ||
                          gigabytes(defaultGiB) === data.default_limit_bytes
                        }
                      >
                        Tallenna oletusraja
                      </ControlButton>
                    </div>
                  </form>
                )}
              </div>
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
                    const quota = storage?.users.find((u) => u.id === user.id);
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.username}</strong>
                        </td>
                        <td>
                          {quota ? (
                            <>
                              {bytes(quota.usage_bytes)} /{" "}
                              {bytes(quota.limit_bytes)}
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
                            isDisabled={!csrf || saving}
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
                                  <ControlButton onPress={() => setEditing("")}>
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
