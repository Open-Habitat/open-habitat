import { type CSSProperties, useEffect, useState } from "react";
import "./NumberControls.css";

/** A slider over a fixed set of values. Equal steps of the track are equal
 * ratios when the stops grow geometrically, so both short and long values are
 * as easy to pick (Jari 29.10.2026: the recap delay is closer to logarithmic).
 * The value commits when the drag or key press ends, not on every move. */
export function ScaleSlider({
  label,
  value,
  stops,
  ticks = [],
  format,
  tickFormat = format,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  /** The values the slider can take, ascending. */
  stops: readonly number[];
  /** Values marked under the track; each must be one of the stops. */
  ticks?: readonly number[];
  format: (value: number) => string;
  /** The ticks' shorter form, when the scale's unit is said once. */
  tickFormat?: (value: number) => string;
  disabled?: boolean;
  testId?: string;
  onChange: (value: number) => void;
}) {
  const nearest = (v: number) =>
    stops.reduce(
      (best, stop, i) =>
        Math.abs(stop - v) < Math.abs(stops[best] - v) ? i : best,
      0,
    );
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onChange(draft);
  };
  const last = Math.max(1, stops.length - 1);
  return (
    <div className="ah-scale" data-testid={testId}>
      <div className="ah-scale-track">
        <input
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={nearest(draft)}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={format(draft)}
          style={
            {
              "--ah-scale-fill": `${(nearest(draft) / last) * 100}%`,
            } as CSSProperties
          }
          onChange={(event) => setDraft(stops[Number(event.target.value)])}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        <div className="ah-scale-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{ left: `${(nearest(tick) / last) * 100}%` }}
            >
              {tickFormat(tick)}
            </span>
          ))}
        </div>
      </div>
      <output className="ah-scale-value" aria-hidden="true">
        {format(draft)}
      </output>
    </div>
  );
}
