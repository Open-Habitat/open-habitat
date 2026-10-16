import { useEffect, useLayoutEffect, useState } from "react";
import { ModelPicker, refused } from "../components/ModelPicker";
import { readModels, usePiModels } from "./PiModels";
export { type Models, loadPiModels } from "./PiModels";
export type Choice = {
  provider?: "openai-codex" | "openai" | "claude-bridge";
  model: string;
  thinking?: string;
};
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
  scope?: "default" | "new" | "recovery" | "conversation" | "empty";
  current?: string;
  currentThinking?: string;
  onChoice?: (choice: Choice) => void | Promise<void>;
  onBlocked?: (blocked: boolean) => void;
}) {
  const [provider, setProvider] = useState<
    "openai-codex" | "openai" | "claude-bridge"
  >("openai-codex");
  const { data, error: loadError, refresh, update } = usePiModels();
  const [selected, setSelected] = useState<string>();
  const [thinking, setThinking] = useState<string>();
  const [also, setAlso] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    refresh();
  }, [refresh]);
  // Initialize before the preloaded rows become interactive.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only defaults initialize selection, not observations.
  useLayoutEffect(() => {
    if (!data) return;
    setProvider(
      current?.startsWith("claude-bridge/")
        ? "claude-bridge"
        : current?.startsWith("openai/")
          ? "openai"
          : current?.startsWith("openai-codex/")
            ? "openai-codex"
            : (data.default_provider ?? "openai-codex"),
    );
    setSelected(
      current?.replace(/^(openai-codex|openai|claude-bridge)\//, "") ??
        data.default_model ??
        undefined,
    );
    setThinking(currentThinking ?? data.default_thinking ?? "off");
    // Catalog refreshes must not discard an unconfirmed selection.
  }, [
    current,
    currentThinking,
    data?.default_provider,
    data?.default_model,
    data?.default_thinking,
  ]);
  useEffect(() => {
    if (!data) return;
    const appliedProvider =
      current?.split("/")[0] ?? data.default_provider ?? "openai-codex";
    const appliedModel =
      current?.replace(/^(openai-codex|openai|claude-bridge)\//, "") ??
      data.default_model;
    onBlocked?.(
      refused(
        data.models.find(
          (m) =>
            (m.provider ?? "openai-codex") === appliedProvider &&
            m.id === appliedModel,
        ),
      ),
    );
  }, [data, current, onBlocked]);
  const save = async (choice: Choice) => {
    if (!csrf) throw Error("unavailable");
    const next = await readModels(
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
    update(next);
  };
  const commit = async (choice: Choice) => {
    setBusy(true);
    setError(false);
    try {
      if (scope === "default" || (scope === "recovery" && also))
        await save(choice);
      setSelected(choice.model);
      setThinking(choice.thinking);
      await onChoice?.({ ...choice, provider: choice.provider ?? provider });
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
              {(["openai-codex", "openai", "claude-bridge"] as const).map(
                (p) => (
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
                    {p === "claude-bridge"
                      ? "Claude-tilaus"
                      : p === "openai"
                        ? "API-avain"
                        : "ChatGPT-tilaus"}
                  </button>
                ),
              )}
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
          {scope === "conversation" ||
          scope === "recovery" ||
          scope === "empty" ? (
            <>
              {scope !== "empty" ? (
                <p className="md-note">
                  Tämän keskustelun mallia ei vaihdeta. Aiemmin lähetettyä
                  viestiä ei toisteta. Luonnos säilyy.
                </p>
              ) : (
                <p className="md-note">
                  Vain tähän keskusteluun. Oletus ei muutu.
                </p>
              )}
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
                {scope === "empty"
                  ? "Valitse"
                  : `Aloita uusi keskustelu mallilla ${selected ?? "…"}`}
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
            </div>
          ) : scope === "new" ? (
            <p className="md-note">Vain tähän keskusteluun. Oletus ei muutu.</p>
          ) : null}
        </>
      ) : (
        <p className="md-note">
          {error || loadError
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
