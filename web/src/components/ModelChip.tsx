import { controlClassName } from "./ControlElements";
import { Icon } from "./Icon";
import type { ModelChoice } from "./ModelPicker";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";
import "./ModelPicker.css";

/** The same native-setting readout, inert in an empty header or a disclosure trigger. */
export function ModelChip({
  as: Element = "span",
  model,
  thinking,
  models,
  className = "",
  "data-testid": testId,
  "aria-label": label,
}: {
  as?: "span" | "summary";
  model?: string;
  thinking?: string;
  models?: ModelChoice[];
  className?: string;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  return (
    <Element
      data-testid={testId}
      data-model={model}
      data-thinking={thinking}
      className={`ah-set-chip ${controlClassName({ size: "inline", presentation: "pill" })} ${className}`}
      aria-label={label}
    >
      {modelDisplayName(model, models)} <Icon name="thinking" />{" "}
      {thinkingDisplayName(thinking)}
    </Element>
  );
}
