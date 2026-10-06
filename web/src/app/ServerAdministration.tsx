import { useCallback, useEffect, useState } from "react";
import { ControlButton, LinkRow } from "../components/ControlElements";
import { Input, Label, TextField } from "react-aria-components";
import {
  administration,
  changeAdministration,
  type Administration,
} from "./serverAdministration";

// This view never receives another user's daemon route, files or credentials.
export function ServerAdministration({ csrf }: { csrf?: string }) {
  const [data, setData] = useState<Administration>();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async (signal?: AbortSignal) => {
    const next = await administration(signal);
    setData(next);
    setName(next.name);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setError("Ylläpitoasetuksia ei voitu ladata.");
    });
    return () => controller.abort();
  }, [reload]);
  const save = async (
    change: { name: string } | { subject: string; administrator: boolean },
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
              void reload().catch(() =>
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
