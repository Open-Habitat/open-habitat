import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "./WarningBanner.css";

/** The common warning (Jari 28.10.2026, proto-github-connection-warning
 * round 2): what the host is doing about a fault or what the person can do,
 * in one shape. Its tone is the soft surface, the border and the icon's
 * round mark, never a stripe down one side.
 *
 * - progress: the host is trying by itself; nothing is asked.
 * - neutral: something does not work, and it is not urgent or not yours.
 * - danger: something you rely on is broken until you act.
 * - success: a fault just went away. */
export type WarningTone = "progress" | "neutral" | "danger" | "success";

const icons: Record<Exclude<WarningTone, "progress">, IconName> = {
  neutral: "info",
  danger: "warning",
  success: "check",
};

export function WarningBanner({
  "data-testid": testId,
  "data-state": state,
  tone,
  title,
  children,
  short,
  actions,
  icon,
  placement = "inline",
}: {
  "data-testid"?: string;
  "data-state"?: string;
  tone: WarningTone;
  /** Left out for a one-line state such as "yritetään uudelleen…". */
  title?: ReactNode;
  children?: ReactNode;
  /** The text at phone width, when the whole one does not fit there. */
  short?: ReactNode;
  /** At most one repair action, plus a quiet second one if needed. */
  actions?: ReactNode;
  icon?: IconName;
  /** inline: a card in a column, such as above the composer; page: the
   * full-width strip under the app's top bar. */
  placement?: "inline" | "page";
}) {
  return (
    <div
      data-testid={testId}
      data-state={state}
      data-tone={tone}
      className={`ah-warning ah-warning-${tone} ah-warning-${placement}${title ? "" : " ah-warning-line"}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span className="ah-warning-mark" aria-hidden="true">
        {tone === "progress" ? (
          <span className="ah-warning-spin" />
        ) : (
          <Icon name={icon ?? icons[tone]} width={14} height={14} />
        )}
      </span>
      <div className="ah-warning-body">
        {title ? <strong>{title}</strong> : null}
        {children && short ? (
          <p>
            <span className="ah-warning-wide">{children}</span>
            <span className="ah-warning-narrow">{short}</span>
          </p>
        ) : children ? (
          <p>{children}</p>
        ) : null}
      </div>
      {actions ? <div className="ah-warning-actions">{actions}</div> : null}
    </div>
  );
}
