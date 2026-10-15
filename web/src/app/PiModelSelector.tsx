import { useEffect, useState } from "react";
import schema from "../../../contracts/v1/pi-models.schema.json";
import Ajv from "ajv/dist/2020.js";

const valid = new Ajv({ strict: false }).compile(schema);
type Models = {
  schema_version: 1;
  default_provider: string | null;
  default_model: string | null;
  models: { id: string; name: string }[];
};

async function read(response: Response): Promise<Models> {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw Error("unavailable");
  const text = await response.text();
  if (text.length > 16384) throw Error("oversize");
  const value: unknown = JSON.parse(text);
  if (!valid(value)) throw Error("invalid model response");
  return value as Models;
}

/** Changing the global Pi default affects new sessions, not the open session. */
export function PiModelSelector({ csrf }: { csrf?: string }) {
  const [data, setData] = useState<Models>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/pi/models", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(read)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <div className="ah-pi-model-selector">
      <label className="ah-pi-model-label" htmlFor="ah-pi-default-model">
        Pi:n oletusmalli uusille keskusteluille
      </label>
      {data ? (
        <select
          id="ah-pi-default-model"
          className="ah-native-select"
          value={
            data.default_provider === "openai-codex"
              ? (data.default_model ?? "")
              : ""
          }
          disabled={busy || !csrf}
          onChange={async (e) => {
            const model = e.target.value;
            if (!model) return;
            setBusy(true);
            setError(false);
            try {
              const next = await read(
                await fetch("/api/v1/pi/models", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Agent-Host-CSRF": csrf ?? "",
                  },
                  body: JSON.stringify({ model }),
                }),
              );
              setData(next);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="" disabled>
            Valitse malli
          </option>
          {data.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.id}
            </option>
          ))}
        </select>
      ) : (
        <p className="ah-pi-model-note">
          {error
            ? "Pi:n malleja ei saada. Tarkista kirjautuminen."
            : "Ladataan Pi:n malleja…"}
        </p>
      )}
      {data?.default_provider && data.default_provider !== "openai-codex" ? (
        <p className="ah-pi-model-note">
          Nykyinen Pi:n oletus on toisen palveluntarjoajan malli:{" "}
          {data.default_provider}/{data.default_model ?? "tuntematon"}.
        </p>
      ) : data?.default_provider === "openai-codex" &&
        data.default_model &&
        !data.models.some((m) => m.id === data.default_model) ? (
        <p className="ah-pi-model-note">
          Nykyinen oletusmalli ei ole käytettävissä: {data.default_model}
        </p>
      ) : null}
      <p className="ah-pi-model-note">
        Pi ilmoittaa käytettävissä olevat mallit, mutta tilisi käyttöoikeus
        selviää vasta viestiä lähettäessä. Mallin vaihtaminen ei muuta avointa
        keskustelua. Aloita uusi keskustelu.
      </p>
      {error && data ? (
        <p className="ah-pi-model-note" role="alert">
          Mallin tallennusta ei voitu vahvistaa. Yritä uudelleen.
        </p>
      ) : null}
    </div>
  );
}
