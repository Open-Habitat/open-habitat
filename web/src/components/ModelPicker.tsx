import "./ModelPicker.css";
import { useId } from "react";
import { liveText } from "../i18n";
import { modelsText } from "../text/models";
import { Segmented } from "./ControlElements";
import { modelCapabilityRank, modelDisplayName } from "./modelPresentation";

const txt = liveText(modelsText);
/** Pi's provider ids: the subscriptions, the API keys and the Claude bridge. */
export type PiProvider =
  | "openai-codex"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "claude-bridge";
/** Strips a `provider/` prefix from a qualified model id. */
export const providerPrefix =
  /^(openai-codex|openai|anthropic|deepseek|claude-bridge)\//;
export type ModelChoice = {
  provider?: PiProvider;
  id: string;
  name: string;
  older?: boolean;
  outcome?: "answered" | "refused";
  observed_at?: string;
  thinking_levels?: string[];
  context_window?: number;
  compaction_reserve_tokens?: number;
};
export function refused(model?: ModelChoice) {
  return (
    model?.outcome === "refused" &&
    !!model.observed_at &&
    Date.now() - Date.parse(model.observed_at) < 7 * 86400000
  );
}
/** Fable and Opus class models do no background work: the whole word of
 * the id or name, as background-model.mjs and the daemon decide it. */
export function backgroundExcluded(model: ModelChoice): boolean {
  return `${model.id} ${model.name}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => word === "fable" || word === "opus");
}
export function ModelPicker({
  models,
  selected,
  thinking,
  busy,
  onSelect,
  onThinking,
  unavailable,
  auto,
}: {
  models: ModelChoice[];
  selected?: string;
  thinking?: string;
  busy?: boolean;
  onSelect: (id: string) => void;
  onThinking?: (level: string) => void;
  /** Why this use cannot take a model the account can; it shows disabled. */
  unavailable?: (model: ModelChoice) => string | undefined;
  /** An Automaattinen row first: what it now picks, whether it is chosen. */
  auto?: { detail: string; selected: boolean; onSelect: () => void };
}) {
  const group = useId();
  const older = models.filter((m) => m.older);
  const reason = (m: ModelChoice) =>
    refused(m) ? txt.unavailable : unavailable?.(m);
  const row = (m: ModelChoice) => (
    <label
      key={m.id}
      className="md-row"
      title={refused(m) ? txt.refusedTitle : undefined}
    >
      <input
        type="radio"
        data-testid={`model-${m.id}`}
        name={group}
        checked={!auto?.selected && selected === m.id}
        disabled={busy || !!reason(m)}
        onChange={() => onSelect(m.id)}
      />
      <span className="md-t">
        {modelDisplayName(`${m.provider ?? "openai-codex"}/${m.id}`, models)}
      </span>
      {reason(m) ? <span className="md-note">{reason(m)}</span> : null}
    </label>
  );
  return (
    <div className="md-pick">
      {auto ? (
        <div className="md-rows">
          <label className="md-row">
            <input
              type="radio"
              data-testid="model-automatic"
              name={group}
              checked={auto.selected}
              disabled={busy}
              onChange={auto.onSelect}
            />
            <span className="md-t">{txt.automatic}</span>
            <span className="md-note">{auto.detail}</span>
          </label>
        </div>
      ) : null}
      {refused(models.find((m) => m.id === selected)) ? (
        <p role="alert">{txt.currentBroken}</p>
      ) : null}
      {models.some((m) => m.outcome === "refused" && !refused(m)) ? (
        <p className="md-note">{txt.oldRefusal}</p>
      ) : null}
      <div className="md-rows">
        {[...models]
          .filter((m) => !m.older)
          .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
          .map(row)}
      </div>
      {older.length ? (
        <details
          className="md-more"
          open={older.some((m) => m.id === selected) || undefined}
        >
          <summary data-testid="older-models-toggle">
            {txt.older(older.length)}
          </summary>
          <div className="md-rows">
            {[...older]
              .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
              .map(row)}
          </div>
        </details>
      ) : null}
      {onThinking ? (
        <div className="md-think">
          <span>{txt.thinking}</span>
          <Segmented
            label={txt.thinking}
            className="md-seg"
            options={[
              "off",
              "minimal",
              "low",
              "medium",
              "high",
              "xhigh",
              "max",
            ].map((level) => ({
              id: level,
              label: level,
              title: txt.supportedLevel(level),
              isDisabled:
                busy ||
                refused(models.find((m) => m.id === selected)) ||
                !models
                  .find((m) => m.id === selected)
                  ?.thinking_levels?.includes(level),
            }))}
            value={thinking}
            onChange={onThinking}
          />
        </div>
      ) : null}
    </div>
  );
}
