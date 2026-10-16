import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ModelPicker, refused } from "../components/ModelPicker";
import { read as readClaudeLogin } from "./ClaudeSignIn";
import { readModels, usePiModels } from "./PiModels";

export { loadPiModels, type Models } from "./PiModels";
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
  const [choiceProvider, setChoiceProvider] = useState(provider);
  const [claudeReady, setClaudeReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const writing = useRef(false);
  const [selected, setSelected] = useState<string>();
  const [thinking, setThinking] = useState<string>();
  const [also, setAlso] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const edited = useRef(false);
  useEffect(() => {
    refresh();
    const controller = new AbortController();
    void fetch("/api/v1/pi/claude-login", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readClaudeLogin)
      .then((login) => {
        if (!controller.signal.aborted)
          setClaudeReady(login.state === "completed");
      })
      .catch(() => {});
    return () => controller.abort();
  }, [refresh]);
  // Initialize before the preloaded rows become interactive.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only defaults initialize selection, not observations.
  useLayoutEffect(() => {
    if (!data || edited.current) return;
    const initialProvider = current?.startsWith("claude-bridge/")
      ? "claude-bridge"
      : current?.startsWith("openai/")
        ? "openai"
        : current?.startsWith("openai-codex/")
          ? "openai-codex"
          : (data.default_provider ?? "openai-codex");
    setProvider(initialProvider);
    setChoiceProvider(initialProvider);
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
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setConfirmed(false);
    setError(false);
    try {
      if (scope === "default" || (scope === "recovery" && also))
        await save(choice);
      await onChoice?.({ ...choice, provider: choice.provider ?? provider });
      setSelected(choice.model);
      setChoiceProvider(choice.provider ?? provider);
      setThinking(choice.thinking);
      setConfirmed(true);
      onBlocked?.(false);
    } catch {
      setError(true);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const candidates =
    data?.models.filter((m) => (m.provider ?? "openai-codex") === provider) ??
    [];
  const choose = (model: string, level = thinking) => {
    if (
      busy ||
      (provider === "claude-bridge" && !claudeReady) ||
      data?.catalog_status === "unavailable" ||
      refused(candidates.find((m) => m.id === model))
    )
      return;
    const supported = candidates.find((m) => m.id === model)?.thinking_levels;
    const next = supported?.includes(level ?? "") ? level : supported?.[0];
    if (scope === "default" || scope === "new")
      void commit({ provider, model, thinking: next });
    else {
      edited.current = true;
      setChoiceProvider(provider);
      setSelected(model);
      setThinking(next);
    }
  };
  return (
    <div className="ah-pi-model-selector" aria-busy={busy}>
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
                      (p === "claude-bridge" && !claudeReady) ||
                      !csrf ||
                      data.catalog_status === "unavailable" ||
                      !data.models.some(
                        (m) =>
                          (m.provider ?? "openai-codex") === p && !refused(m),
                      )
                    }
                    onClick={() => {
                      // Browsing credentials is not a model-selection intent.
                      setProvider(p);
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
          {!claudeReady ? (
            <p className="md-note">
              Claude-tilaus ei ole käytettävissä: kirjautumista ei ole
              vahvistettu. <a href="/settings#yhteydet">Yhteydet</a>
            </p>
          ) : null}
          {data.default_model &&
          !candidates.some((m) => m.id === data.default_model) ? (
            <p className="md-note">
              Nykyinen Pi:n oletus: {data.default_provider}/{data.default_model}
              . Sitä ei muuteta automaattisesti.
            </p>
          ) : null}
          <ModelPicker
            key={provider}
            models={candidates}
            provider={provider}
            selected={choiceProvider === provider ? selected : undefined}
            thinking={choiceProvider === provider ? thinking : undefined}
            busy={
              busy ||
              !csrf ||
              data.catalog_status === "unavailable" ||
              (provider === "claude-bridge" && !claudeReady)
            }
            onSelect={choose}
            onThinking={(level) => {
              if (selected && choiceProvider === provider)
                choose(selected, level);
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
                  choiceProvider !== provider ||
                  (provider === "claude-bridge" && !claudeReady) ||
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
      <p role="status" className="md-note">
        {busy
          ? "Tallennetaan valintaa…"
          : confirmed
            ? "Valinta vahvistettu."
            : ""}
      </p>
      {error && data ? (
        <p role="alert">
          Mallin tallennusta ei voitu vahvistaa. Yritä uudelleen.
        </p>
      ) : null}
    </div>
  );
}
