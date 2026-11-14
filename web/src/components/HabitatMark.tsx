import type { CSSProperties } from "react";
import "./HabitatMark.css";

/** The Open Habitat mark: the ring is the habitat, the dot is its resident
 * (the agent), the opening is the door. As a state indicator the state shows
 * in both shape and colour, so it survives 14–16 px, reduced motion and
 * forced colours (the mark is drawn with currentColor). */
export type MarkState =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "read"
  | "background"
  | "done"
  | "error"
  | "unknown"
  | "awaited"
  | "stopping"
  | "loading"
  | "intro";

/** A sub-agent's dot orbiting the resident. */
export type SubMarkState =
  | "idle"
  | "working"
  | "thinking"
  | "waiting"
  | "error";

/** Orbiting dots are readable only from 20 px and up to three of them
 * (Jari 14.11.2026); otherwise the number of sub-agents is a figure. */
export const SUB_DOT_MIN_SIZE = 20;
export const SUB_DOT_MAX = 3;
const ORBIT = 5.6;

const RING =
  "M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z";

export function HabitatMark({
  state = "idle",
  size = 16,
  subs = [],
  label,
  className,
  title,
  variant = "mark",
  "data-testid": testId,
}: {
  state?: MarkState;
  /** "ring" draws only the habitat around something else (the narrow
   * rail's workspace icon), with the resident at the door when it is the
   * person's turn or something went wrong. */
  variant?: "mark" | "ring";
  /** Rendered size in CSS pixels. */
  size?: number;
  /** The agent's sub-agents, one entry each. */
  subs?: readonly SubMarkState[];
  /** Name the mark for assistive technology; otherwise it is decorative and
   * the state is said in words beside it. */
  label?: string;
  className?: string;
  title?: string;
  "data-testid"?: string;
}) {
  const dots =
    variant === "mark" &&
    size >= SUB_DOT_MIN_SIZE &&
    subs.length <= SUB_DOT_MAX;
  const svg = (
    <svg
      className={`oh-mark${className && !(subs.length && !dots) ? ` ${className}` : ""}`}
      data-state={state}
      data-variant={variant === "ring" ? "ring" : undefined}
      data-testid={subs.length && !dots ? undefined : testId}
      viewBox="-12 -12 24 24"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path className="oh-ring" pathLength={100} d={RING} />
      {variant === "ring" ? (
        <circle className="oh-dot oh-door" r={1.8} cx={7.4} cy={-7.4} />
      ) : (
        <circle className="oh-dot" r={2.5} />
      )}
      {dots && subs.length ? (
        <g className="oh-orbit">
          {subs.map((sub, i) => {
            // Evenly spaced, the first towards the door.
            const angle = -Math.PI / 4 + (i * 2 * Math.PI) / subs.length;
            return (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional
                key={i}
                className="oh-sub"
                data-state={sub}
                r={1.3}
                cx={(ORBIT * Math.cos(angle)).toFixed(2)}
                cy={(ORBIT * Math.sin(angle)).toFixed(2)}
              />
            );
          })}
        </g>
      ) : null}
    </svg>
  );
  if (!subs.length || dots || variant === "ring") return svg;
  return (
    <span
      className={`oh-mark-with-count${className ? ` ${className}` : ""}`}
      data-testid={testId}
      style={{ "--oh-mark-size": `${size}px` } as CSSProperties}
    >
      {svg}
      <span className="oh-mark-count" aria-hidden="true">
        {subs.length}
      </span>
    </span>
  );
}
