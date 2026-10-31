import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ControlButton, Segmented } from "../components/ControlElements";
import { ConversationModelDetails } from "../components/ConversationModelDetails";
import {
  backgroundExcluded,
  ModelPicker,
  type PiProvider,
  providerPrefix,
  refused,
} from "../components/ModelPicker";
import { modelDisplayName } from "../components/modelPresentation";
import { liveText } from "../i18n";
import { modelsText } from "../text/models";
import { read as readClaudeLogin } from "./ClaudeSignIn";
import { usePiModels } from "./PiModels";
import { settingsHref } from "./settingsRoute";

const txt = liveText(modelsText);

export { loadPiModels, type Models } from "./PiModels";
export type Choice = {
  provider?: PiProvider;
  model: string;
  thinking?: string;
};
const providerLabel = (provider: PiProvider) => txt.routes[provider];
/** A selection is Pi's global default, an explicit new-session intent, or
 * (scope background) the model the recap prefers, where current undefined is
 * the automatic choice and onAutomatic chooses it again. */
export function PiModelSelector({
  csrf,
  scope = "default",
  current,
  currentThinking,
  onChoice,
  onAutomatic,
  onBlocked,
}: {
  csrf?: string;
  scope?:
    | "default"
    | "new"
    | "recovery"
    | "conversation"
    | "empty"
    | "background";
  current?: string;
  currentThinking?: string;
  onChoice?: (choice: Choice) => void | Promise<void>;
  onAutomatic?: () => void | Promise<void>;
  onBlocked?: (blocked: boolean) => void;
}) {
  const [provider, setProvider] = useState<PiProvider>("openai-codex");
  const {
    data,
    error: loadError,
    refresh,
    chooseDefault,
    defaultSlow,
    defaultRefusal,
  } = usePiModels();
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
  }, [refresh]);
  const hasClaudeModels = !!data?.models.some(
    (model) => model.provider === "claude-bridge",
  );
  useEffect(() => {
    // Each catalog read also re-reads Claude's sign-in: a sign-in finished on
    // the same settings page refreshes the catalog, not this selector.
    void data;
    if (!hasClaudeModels) return;
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
  }, [hasClaudeModels, data]);
  // Initialize before the preloaded rows become interactive.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only defaults initialize selection, not observations.
  useLayoutEffect(() => {
    if (!data || edited.current) return;
    const initialProvider =
      (providerPrefix.exec(current ?? "")?.[1] as PiProvider | undefined) ??
      data.default_provider ??
      "openai-codex";
    setProvider(initialProvider);
    setChoiceProvider(initialProvider);
    setSelected(
      current?.replace(providerPrefix, "") ??
        (scope === "background" ? undefined : data.default_model) ??
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
    if (!data || scope === "background") return;
    const appliedProvider =
      current?.split("/")[0] ?? data.default_provider ?? "openai-codex";
    const appliedModel =
      current?.replace(providerPrefix, "") ?? data.default_model;
    onBlocked?.(
      refused(
        data.models.find(
          (m) =>
            (m.provider ?? "openai-codex") === appliedProvider &&
            m.id === appliedModel,
        ),
      ),
    );
  }, [data, current, onBlocked, scope]);
  // Pi's default is optimistic (browser-mutation-layer): the choice shows
  // at once and Pi confirms in the background; a refusal reverts it.
  const saveDefault = async (choice: Choice) => {
    if (!csrf) throw Error("unavailable");
    const outcome = await chooseDefault(
      {
        provider: choice.provider ?? provider,
        model: choice.model,
        thinking: choice.thinking,
      },
      csrf,
    );
    if (outcome === "refused") throw Error("refused");
    return outcome;
  };
  const commit = async (choice: Choice | "automatic") => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setConfirmed(false);
    setError(false);
    try {
      if (choice === "automatic") {
        await onAutomatic?.();
        setSelected(undefined);
        setConfirmed(true);
        return;
      }
      if (scope === "recovery" && also) await saveDefault(choice);
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
    const candidate = candidates.find((m) => m.id === model);
    if (
      busy ||
      (provider === "claude-bridge" && !claudeReady) ||
      data?.catalog_status === "unavailable" ||
      refused(candidate) ||
      (scope === "background" && candidate && backgroundExcluded(candidate))
    )
      return;
    // The recap's model takes no thinking level: Pi's background completion
    // is not given one (recap-extension.mjs).
    if (scope === "background") {
      void commit({ provider, model });
      return;
    }
    const supported = candidates.find((m) => m.id === model)?.thinking_levels;
    const next = supported?.includes(level ?? "") ? level : supported?.[0];
    if (scope === "default") {
      setChoiceProvider(provider);
      setSelected(model);
      setThinking(next);
      const choice = { provider, model, thinking: next };
      void saveDefault(choice).then(
        (outcome) => {
          if (outcome === "confirmed") void onChoice?.(choice);
        },
        () => {},
      );
    } else if (scope === "new")
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
            <p role="alert" data-testid="model-catalog-unavailable">
              {txt.catalogUnavailable(
                <a href={settingsHref("tekoaly")}>{txt.ai}</a>,
              )}
            </p>
          ) : null}
          <div className="s-row">
            <Segmented
              label={txt.provider}
              // Anthropic and DeepSeek appear once their key has models.
              options={(
                [
                  "openai-codex",
                  "openai",
                  "anthropic",
                  "deepseek",
                  "claude-bridge",
                ] as const
              )
                .filter(
                  (p) =>
                    (p !== "anthropic" && p !== "deepseek") ||
                    p === provider ||
                    data.models.some((m) => m.provider === p),
                )
                .map((p) => ({
                  id: p,
                  label: providerLabel(p),
                  isDisabled:
                    busy ||
                    (p === "claude-bridge" && !claudeReady) ||
                    !csrf ||
                    data.catalog_status === "unavailable" ||
                    !data.models.some(
                      (m) =>
                        (m.provider ?? "openai-codex") === p && !refused(m),
                    ),
                }))}
              value={provider}
              // Browsing credentials is not a model-selection intent.
              onChange={setProvider}
            />
          </div>
          {!claudeReady ? (
            <p className="md-note" data-testid="claude-provider-unavailable">
              {txt.claudeUnavailable}{" "}
              <a
                data-testid="settings-claude"
                href={settingsHref("tekoaly", "claude")}
              >
                {txt.aiSettings}
              </a>
            </p>
          ) : null}
          {data.default_model &&
          !data.models.some(
            (m) =>
              m.id === data.default_model &&
              (m.provider ?? "openai-codex") === data.default_provider,
          ) ? (
            <p className="md-note">
              {txt.currentDefault(
                `${data.default_provider}/${data.default_model}`,
              )}
            </p>
          ) : null}
          <ModelPicker
            key={provider}
            models={candidates}
            selected={choiceProvider === provider ? selected : undefined}
            thinking={choiceProvider === provider ? thinking : undefined}
            busy={
              busy ||
              !csrf ||
              data.catalog_status === "unavailable" ||
              (provider === "claude-bridge" && !claudeReady)
            }
            onSelect={choose}
            onThinking={
              scope === "background"
                ? undefined
                : (level) => {
                    if (selected && choiceProvider === provider)
                      choose(selected, level);
                  }
            }
            unavailable={
              scope === "background"
                ? (m) =>
                    backgroundExcluded(m) ? txt.notForBackground : undefined
                : undefined
            }
            auto={
              scope === "background"
                ? {
                    detail: data.background_models?.[provider]
                      ? txt.now(
                          modelDisplayName(
                            `${provider}/${data.background_models[provider]}`,
                            data.models,
                          ),
                        )
                      : txt.conversationOwn,
                    selected: !current,
                    onSelect: () => void commit("automatic"),
                  }
                : undefined
            }
          />
          {scope === "recovery" ? (
            <label className="md-also">
              <input
                type="checkbox"
                checked={also}
                onChange={(e) => setAlso(e.target.checked)}
              />
              {txt.alsoDefault}
            </label>
          ) : null}
          {scope === "conversation" ||
          scope === "recovery" ||
          scope === "empty" ? (
            <div
              className={scope === "empty" ? "md-picker-actions" : undefined}
            >
              {scope !== "empty" ? (
                <p className="md-note">{txt.notChanged}</p>
              ) : (
                <a
                  className="md-note"
                  data-testid="model-default-settings"
                  href={settingsHref("tekoaly", "default-model")}
                >
                  {txt.changeDefault}
                </a>
              )}
              <ControlButton
                variant="primary"
                size="page"
                className="md-commit"
                data-testid="model-commit"
                isDisabled={
                  busy ||
                  !csrf ||
                  !selected ||
                  choiceProvider !== provider ||
                  (provider === "claude-bridge" && !claudeReady) ||
                  data.catalog_status === "unavailable" ||
                  refused(candidates.find((m) => m.id === selected))
                }
                onPress={() => {
                  if (selected) void commit({ model: selected, thinking });
                }}
              >
                {scope === "empty"
                  ? txt.choose
                  : txt.startWith(selected ?? "…")}
              </ControlButton>
            </div>
          ) : null}
          {scope === "default" ? (
            <div>
              <p className="md-note">{txt.savedToPi}</p>
            </div>
          ) : scope === "new" ? (
            <a
              className="md-note"
              data-testid="model-default-settings"
              href={settingsHref("tekoaly", "default-model")}
            >
              {txt.changeDefault}
            </a>
          ) : null}
        </>
      ) : (
        <p className="md-note">
          {error || loadError ? txt.noModels : txt.loadingModels}
        </p>
      )}
      <p
        role="status"
        className="md-note"
        data-testid="model-save-state"
        data-pending={scope === "default" && defaultSlow}
      >
        {busy
          ? txt.saving
          : scope === "default" && defaultSlow
            ? txt.confirming
            : confirmed
              ? txt.confirmed
              : ""}
      </p>
      {scope === "default" && defaultRefusal ? (
        <p role="alert" data-testid="model-save-refused">
          {txt.defaultRefused(defaultRefusal)}
        </p>
      ) : null}
      {error && data ? <p role="alert">{txt.saveUncertain}</p> : null}
    </div>
  );
}

/** Native conversation state, not a form for starting another conversation. */
export function ConversationModelInfo({
  model,
  thinking,
}: {
  model?: string;
  thinking?: string;
}) {
  const { data, refresh } = usePiModels();
  useEffect(() => {
    refresh();
  }, [refresh]);
  return (
    <ConversationModelDetails
      model={model}
      thinking={thinking}
      models={data?.models}
    />
  );
}
