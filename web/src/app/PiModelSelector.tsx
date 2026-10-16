import Ajv from "ajv/dist/2020.js";
import { useEffect, useState } from "react";
import schema from "../../../contracts/v1/pi-models.schema.json";
import {
  type ModelChoice,
  ModelPicker,
  refused,
} from "../components/ModelPicker";

const valid = new Ajv({ strict: false }).compile(schema);
type Models = {
  schema_version: 1;
  default_provider: string | null;
  default_model: string | null;
  default_thinking?: string;
  catalog_status?: "native_cached" | "unavailable";
  models: ModelChoice[];
};
export type Choice = { model: string; thinking?: string };
async function read(response: Response): Promise<Models> {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw Error("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("unavailable");
  let text = "";
  let size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw Error("oversize");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(text);
  if (!valid(value)) throw Error("invalid model response");
  return value as Models;
}
/** A selection is either Pi's global default or an explicit new-session intent. */
export function PiModelSelector({
  csrf,
  scope = "default",
  current,
  onChoice,
}: {
  csrf?: string;
  scope?: "default" | "new" | "recovery" | "conversation";
  current?: string;
  onChoice?: (choice: Choice) => void;
}) {
  const [data, setData] = useState<Models>();
  const [selected, setSelected] = useState<string>();
  const [thinking, setThinking] = useState<string>();
  const [also, setAlso] = useState(true);
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
        if (controller.signal.aborted) return;
        setData(value);
        setSelected(
          current?.replace(/^openai-codex\//, "") ??
            value.default_model ??
            undefined,
        );
        setThinking(value.default_thinking ?? "off");
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [current]);
  const save = async (choice: Choice) => {
    if (!csrf) throw Error("unavailable");
    const next = await read(
      await fetch("/api/v1/pi/models", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(choice),
      }),
    );
    setData(next);
  };
  const commit = async (choice: Choice) => {
    setBusy(true);
    setError(false);
    try {
      if (scope === "default" || (scope === "recovery" && also))
        await save(choice);
      setSelected(choice.model);
      setThinking(choice.thinking);
      onChoice?.(choice);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const choose = (model: string, level = thinking) => {
    const supported = data?.models.find((m) => m.id === model)?.thinking_levels;
    const next = supported?.includes(level ?? "") ? level : supported?.[0];
    if (scope === "default" || scope === "new")
      void commit({ model, thinking: next });
    else {
      setSelected(model);
      setThinking(next);
    }
  };
  return (
    <div className="ah-pi-model-selector">
      {data ? (
        <>
          {data.catalog_status === "unavailable" ? (
            <p role="alert">
              Pi:n malliluetteloa ei saatu. Alla ovat vain keskusteluista tutut
              mallit. Tarkista Pi:n kirjautuminen asetuksista.
            </p>
          ) : null}
          <ModelPicker
            models={data.models}
            selected={selected}
            thinking={thinking}
            busy={busy || !csrf}
            onSelect={choose}
            onThinking={(level) => {
              if (selected) choose(selected, level);
            }}
          />
          {scope === "recovery" ? (
            <label className="md-also">
              <input
                type="checkbox"
                checked={also}
                onChange={(e) => setAlso(e.target.checked)}
              />
              Tee siitä myös uusien keskustelujen oletus
            </label>
          ) : null}
          {scope === "conversation" || scope === "recovery" ? (
            <>
              <p className="md-note">
                Tämän keskustelun mallia ei vaihdeta. Aiemmin lähetettyä viestiä
                ei toisteta. Luonnos säilyy.
              </p>
              <button
                type="button"
                className="md-btn primary"
                disabled={
                  busy ||
                  !csrf ||
                  !selected ||
                  refused(data.models.find((m) => m.id === selected))
                }
                onClick={() => {
                  if (selected) void commit({ model: selected, thinking });
                }}
              >
                Aloita uusi keskustelu mallilla {selected ?? "…"}
              </button>
            </>
          ) : null}
          {scope === "default" ? (
            <p className="md-note">
              Tallentuu Pi:n omaan oletukseen (~/.pi/agent/settings.json), joten
              sama malli on käytössä myös SSH:lla. Avoimet keskustelut eivät
              vaihdu.
            </p>
          ) : scope === "new" ? (
            <p className="md-note">Vain tähän keskusteluun. Oletus ei muutu.</p>
          ) : null}
        </>
      ) : (
        <p className="md-note">
          {error
            ? "Pi:n malleja ei saada. Tarkista kirjautuminen."
            : "Ladataan Pi:n malleja…"}
        </p>
      )}
      {error && data ? (
        <p role="alert">
          Mallin tallennusta ei voitu vahvistaa. Yritä uudelleen.
        </p>
      ) : null}
    </div>
  );
}
