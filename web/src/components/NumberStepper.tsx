import { useEffect, useState } from "react";
import { controlClassName } from "./ControlElements";
import "./NumberControls.css";
import { formatNumber as formatLocal, liveText } from "../i18n";
import { recapSettingsText } from "../text/recapSettings";

const txt = liveText(recapSettingsText);

/** A number as the interface's language writes it: 16 000, 16,000. */
export const formatNumber = (value: number) => formatLocal(value);

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
    // Spaces and comma thousands (16 000, 16,000) group digits; any other
    // comma is a decimal one, so 9,5 rounds to 10 rather than reading 95.
    const text = draft.replace(/\s/g, "");
    const parsed = Number(
      /^\d{1,3}(,\d{3})+$/.test(text)
        ? text.replace(/,/g, "")
        : text.replace(",", "."),
    );
    const next =
      Number.isFinite(parsed) && draft.trim() ? clamp(parsed) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  const button = controlClassName({
    variant: "quiet",
    size: "row",
    presentation: "icon",
  });
  return (
    <fieldset className="ah-stepper" data-testid={testId} aria-label={label}>
      <span className="ah-stepper-box">
        <button
          type="button"
          className={button}
          data-testid={testId && `${testId}-less`}
          aria-label={txt.less(label)}
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
        <button
          type="button"
          className={button}
          data-testid={testId && `${testId}-more`}
          aria-label={txt.more(label)}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </span>
      {unit ? <span className="ah-stepper-unit">{unit}</span> : null}
    </fieldset>
  );
}
