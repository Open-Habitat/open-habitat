import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { useEffect, useState } from "react";
import schema from "../../../contracts/v1/pi-models.schema.json";
import {
  type ModelChoice,
  ModelPicker,
  refused,
} from "../components/ModelPicker";

const validator = new Ajv({ strict: false });
addFormats(validator);
const valid = validator.compile(schema);
type Models = {
  schema_version: 1;
  default_provider: string | null;
  default_model: string | null;
  default_thinking?: string;
  catalog_status?: "native_cached" | "unavailable";
  models: ModelChoice[];
};
export type Choice = {
  provider?: "openai-codex" | "openai";
  model: string;
  thinking?: string;
};
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
  currentThinking,
  onChoice,
  onBlocked,
}: {
  csrf?: string;
  scope?: "default" | "new" | "recovery" | "conversation";
  current?: string;
  currentThinking?: string;
  onChoice?: (choice: Choice) => void;
  onBlocked?: (blocked: boolean) => void;
}) {
  const [provider, setProvider] = useState<"openai-codex" | "openai">(
    "openai-codex",
  );
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
        setProvider(
          current?.startsWith("openai/")
            ? "openai"
            : !current?.startsWith("openai-codex/") &&
                value.default_provider === "openai"
              ? "openai"
              : "openai-codex",
        );
        setSelected(
          current?.replace(/^(openai-codex|openai)\//, "") ??
            value.default_model ??
            undefined,
        );
        setThinking(currentThinking ?? value.default_thinking ?? "off");
        onBlocked?.(
          refused(
            value.models.find(
              (m) =>
                (m.provider ?? "openai-codex") ===
                  (current?.startsWith("openai/")
                    ? "openai"
                    : current?.startsWith("openai-codex/")
                      ? "openai-codex"
                      : (value.default_provider ?? "openai-codex")) &&
                m.id ===
                  (current?.replace(/^(openai-codex|openai)\//, "") ??
                    value.default_model),
            ),
          ),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [current, currentThinking, onBlocked]);
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
        body: JSON.stringify({
          ...choice,
          provider: choice.provider ?? provider,
        }),
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
      onChoice?.({ ...choice, provider: choice.provider ?? provider });
      onBlocked?.(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const candidates =
    data?.models.filter((m) => (m.provider ?? "openai-codex") === provider) ??
    [];
  const choose = (model: string, level = thinking) => {
    if (
      data?.catalog_status === "unavailable" ||
      refused(candidates.find((m) => m.id === model))
    )
      return;
    const supported = candidates.find((m) => m.id === model)?.thinking_levels;
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
          <div className="s-row">
            <div className="s-lbl">
              <strong>Uusien keskustelujen tunnus</strong>
              <span className="s-desc">
                API-avain laskutetaan käytön mukaan. Avoimet keskustelut
                jatkavat omallaan.
              </span>
            </div>
            <fieldset
              className="s-seg"
              aria-label="Uusien keskustelujen tunnus"
            >
              {(["openai-codex", "openai"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={provider === p}
                  disabled={
                    busy ||
                    !csrf ||
                    data.catalog_status === "unavailable" ||
                    !data.models.some(
                      (m) =>
                        (m.provider ?? "openai-codex") === p && !refused(m),
                    )
                  }
                  onClick={() => {
                    const models = data.models.filter(
                      (m) =>
                        (m.provider ?? "openai-codex") === p && !refused(m),
                    );
                    const next =
                      models.find((m) => m.id === selected) ?? models[0];
                    if (!next) return;
                    setProvider(p);
                    if (scope === "default" || scope === "new")
                      void commit({
                        provider: p,
                        model: next.id,
                        thinking: next.thinking_levels?.[0],
                      });
                    else {
                      setSelected(next.id);
                      setThinking(next.thinking_levels?.[0]);
                    }
                  }}
                >
                  {p === "openai" ? "API-avain" : "ChatGPT-tilaus"}
                </button>
              ))}
            </fieldset>
          </div>
          {data.default_model &&
          !candidates.some((m) => m.id === data.default_model) ? (
            <p className="md-note">
              Nykyinen Pi:n oletus: {data.default_provider}/{data.default_model}
              . Sitä ei muuteta automaattisesti.
            </p>
          ) : null}
          <ModelPicker
            models={candidates}
            provider={provider}
            selected={selected}
            thinking={thinking}
            busy={busy || !csrf || data.catalog_status === "unavailable"}
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
                  data.catalog_status === "unavailable" ||
                  refused(candidates.find((m) => m.id === selected))
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
            <div>
              <p className="md-note">
                Tallentuu Pi:n omaan oletukseen (~/.pi/agent/settings.json),
                joten sama malli on käytössä myös SSH:lla. Avoimet keskustelut
                eivät vaihdu.
              </p>
              <div className="md-group-off">
                <strong>Claude</strong>
                <p className="md-note">
                  Claude tulee omana agenttinaan, ei Pi:n mallina.
                </p>
              </div>
            </div>
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
