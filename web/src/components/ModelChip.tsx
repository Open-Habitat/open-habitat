import { controlClassName } from "./ControlElements";
import { Icon } from "./Icon";
import type { ModelChoice } from "./ModelPicker";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";
import "./ModelPicker.css";

/** "Opus 5.5 · ajattelutaso Medium": the header chip's tooltip and the
 * words its accessible name and the ⋯ menu use for the hidden level. */
export function modelSummary(
  model?: string,
  thinking?: string,
  models?: ModelChoice[],
) {
  return `${modelDisplayName(model, models)} · ajattelutaso ${thinkingDisplayName(thinking)}`;
}

/** The same native-setting readout, inert in an empty header or a disclosure
 * trigger. The conversation header draws it `compact`: the model's short
 * name only, the thinking level in its tooltip, its name and its layer
 * (proto-conversation-header round 2); the composer's picker, where the
 * level is chosen, keeps both. */
export function ModelChip({
  as: Element = "span",
  model,
  thinking,
  models,
  compact = false,
  className = "",
  "data-testid": testId,
  "aria-label": label,
}: {
  as?: "span" | "summary";
  model?: string;
  thinking?: string;
  models?: ModelChoice[];
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  const summary = compact ? modelSummary(model, thinking, models) : undefined;
  return (
    <Element
      data-testid={testId}
      data-model={model}
      data-thinking={thinking}
      data-menu-summary={summary}
      className={`ah-set-chip${compact ? " ah-set-compact" : ""} ${controlClassName({ size: "inline", presentation: "pill" })} ${className}`}
      aria-label={label}
      title={summary}
    >
      <span className="ah-set-model">{modelDisplayName(model, models)}</span>
      {compact ? (
        <span className="ah-visually-hidden">
          {" "}
          · ajattelutaso {thinkingDisplayName(thinking)}
        </span>
      ) : (
        <>
          {" "}
          <Icon name="thinking" />{" "}
          <span className="ah-set-thinking">
            {thinkingDisplayName(thinking)}
          </span>
        </>
      )}
    </Element>
  );
}
