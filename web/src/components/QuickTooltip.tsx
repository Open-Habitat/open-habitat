import type { ComponentProps, ReactNode } from "react";
import {
  Focusable,
  Tooltip,
  TooltipContext,
  type TooltipProps,
  TooltipTrigger,
  useContextProps,
} from "react-aria-components";
import styles from "./QuickTooltip.module.css";

/** Native disabled buttons cannot receive focus or tooltip trigger props.
 * Give their help a keyboard stop and a real description owner, not just an
 * event handler that opens an otherwise unassociated portal. */
export function DisabledTooltipTrigger({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Focusable>
      {/* biome-ignore lint/a11y/useSemanticElements: inline help trigger, not a form fieldset */}
      <span className={styles.disabledTrigger} role="group" aria-label={label}>
        {children}
      </span>
    </Focusable>
  );
}

export function TooltipButton({
  title,
  ...props
}: ComponentProps<"button"> & { title: string }) {
  return (
    <QuickTooltip label={title}>
      {props.disabled ? (
        <DisabledTooltipTrigger label={props["aria-label"] || title}>
          <button {...props} />
        </DisabledTooltipTrigger>
      ) : (
        <Focusable>
          <button {...props} />
        </Focusable>
      )}
    </QuickTooltip>
  );
}

export function TooltipLink({
  title,
  ...props
}: ComponentProps<"a"> & { title: string }) {
  return (
    <QuickTooltip label={title}>
      <Focusable>
        <a {...props} />
      </Focusable>
    </QuickTooltip>
  );
}

/** React Aria shares the warm-up between triggers, supports keyboard/Escape,
 * ignores touch hover and keeps help in the trigger's document landmark. */
function TooltipContent({ label }: { label: string }) {
  const defaults: TooltipProps = {};
  const [props] = useContextProps(defaults, null, TooltipContext);
  // Description linkage alone does not place a body-level portal in a landmark.
  const container =
    props.triggerRef?.current?.closest(
      'main, aside, nav, [role="main"], [role="complementary"], [role="navigation"], [role="banner"], [role="contentinfo"]',
    ) ?? props.triggerRef?.current?.closest("header, footer");
  return (
    <Tooltip
      className={styles.tooltip}
      placement="bottom"
      offset={8}
      UNSTABLE_portalContainer={container ?? undefined}
    >
      {label}
    </Tooltip>
  );
}

export function QuickTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <TooltipTrigger delay={250} closeDelay={100}>
      {children}
      <TooltipContent label={label} />
    </TooltipTrigger>
  );
}
