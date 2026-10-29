import { useEffect, useState } from "react";
import { controlClassName } from "./ControlElements";
import "./NumberControls.css";

const grouped = new Intl.NumberFormat("fi-FI");
/** A number as Finnish text: 16 000. */
export const formatNumber = (value: number) => grouped.format(value);

/** A bounded whole number with − and + buttons and its unit. A typed value
 * commits on Enter or leaving the field and is held within the bounds. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  testId?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const commit = () => {
    const parsed = Number(draft.replace(/\s/g, ""));
    const next =
      Number.isFinite(parsed) && draft.trim() ? clamp(parsed) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  const button = controlClassName({
    variant: "quiet",
    size: "inline",
    presentation: "icon",
  });
  return (
    <fieldset className="ah-stepper" data-testid={testId} aria-label={label}>
      <button
        type="button"
        className={button}
        data-testid={testId && `${testId}-less`}
        aria-label={`${label}: vähemmän`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        data-testid={testId && `${testId}-input`}
        aria-label={label}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(clamp(value + (event.key === "ArrowUp" ? step : -step)));
          }
        }}
      />
      {unit ? <span className="ah-stepper-unit">{unit}</span> : null}
      <button
        type="button"
        className={button}
        data-testid={testId && `${testId}-more`}
        aria-label={`${label}: enemmän`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        +
      </button>
    </fieldset>
  );
}
