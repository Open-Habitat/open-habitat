import { useCallback, useEffect, useState } from "react";
import { ControlButton, LinkRow } from "../components/ControlElements";
import { Input, Label, TextField } from "react-aria-components";
import {
  administration,
  changeAdministration,
  type Administration,
} from "./serverAdministration";

import {
  bytes,
  changeStorage,
  storageAdministration,
  type StorageAdministration,
} from "./storageQuota";

// This view never receives another user's daemon route, files or credentials.
export function ServerAdministration({ csrf }: { csrf?: string }) {
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
  return (
    <section className="ah-administration">
      <LinkRow href="/workspaces" kind="inline">
        Takaisin työtiloihin
      </LinkRow>
      <h1>Palvelimen ylläpito</h1>
      <p>
        Selainrooli sallii vain jaettujen asetusten muuttamisen. Se ei avaa
        muiden työtiloja, keskusteluja tai tunnuksia.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
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
      {data ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save({ name: name.trim() });
            }}
          >
            <TextField value={name} onChange={setName} maxLength={80}>
              <Label>Palvelimen nimi</Label>
              <Input />
            </TextField>
            <ControlButton
              type="submit"
              isDisabled={!csrf || saving || name.trim() === data.name}
            >
              Tallenna nimi
            </ControlButton>
          </form>
          <h2>Tallennustilan oletusraja</h2>
          <p>
            Uusien käyttäjien raja. Aseta tämä ennen ensimmäistä kirjautumista;
            se ei muuta nykyisiä rajoja.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const limit = gigabytes(defaultGiB);
              if (limit !== undefined)
                void save({ default_limit_bytes: limit });
            }}
          >
            <TextField value={defaultGiB} onChange={setDefaultGiB}>
              <Label>Oletusraja (GiB)</Label>
              <Input inputMode="decimal" />
            </TextField>
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
          </form>
          <h2>Tallennustila</h2>
          {storageError && (
            <div role="alert">
              {storageError}{" "}
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
          {storage && (
            <>
              <p>
                Levytilaa yhteensä {bytes(storage.filesystem.capacity_bytes)},
                vapaana {bytes(storage.filesystem.free_bytes)}.
              </p>
              {storage.overcommitted && (
                <p role="status">
                  Käyttäjien rajojen summa ylittää levyn kapasiteetin.
                  Ylibuukkaus on sallittu, mutta levy voi täyttyä.
                </p>
              )}
              <ul>
                {storage.users.map((u) => (
                  <li key={u.id}>
                    {u.username}: käytössä {bytes(u.usage_bytes)} /{" "}
                    {bytes(u.limit_bytes)}.
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveLimit(u.id);
                      }}
                    >
                      <TextField
                        value={limits[u.id] ?? ""}
                        onChange={(value) =>
                          setLimits((current) => ({
                            ...current,
                            [u.id]: value,
                          }))
                        }
                      >
                        <Label>{u.username}: raja (GiB)</Label>
                        <Input inputMode="decimal" />
                      </TextField>
                      <ControlButton
                        type="submit"
                        isDisabled={
                          !csrf ||
                          saving ||
                          gigabytes(limits[u.id] ?? "") === undefined ||
                          gigabytes(limits[u.id] ?? "") === u.limit_bytes
                        }
                      >
                        Tallenna raja
                      </ControlButton>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2>Palvelimelle sidotut käyttäjät</h2>
          <p>Roolin muuttaminen ei hyväksy uusia käyttäjiä palvelimelle.</p>
          <ul>
            {data.users.map((user) => (
              <li key={user.id}>
                <span>
                  {user.username} (GitHub ID {user.id})
                </span>{" "}
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
              </li>
            ))}
          </ul>
        </>
      ) : (
        !error && <p>Ladataan ylläpitoasetuksia…</p>
      )}
    </section>
  );
}
