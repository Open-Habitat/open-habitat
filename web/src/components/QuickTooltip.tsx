import { type ComponentProps, type ReactNode, useContext } from "react";
import {
  Focusable,
  Tooltip,
  TooltipTrigger,
  TooltipTriggerStateContext,
} from "react-aria-components";
import styles from "./QuickTooltip.module.css";

/** Disabled buttons retain native semantics and do not consume focus props.
 * Observe their pointer on a layout-neutral ancestor; position at the button. */
export function DisabledTooltipHover({ children }: { children: ReactNode }) {
  const state = useContext(TooltipTriggerStateContext);
  return (
    <span
      style={{ display: "contents" }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") state?.open();
      }}
      onPointerLeave={() => state?.close()}
    >
      {children}
    </span>
  );
}

export function TooltipButton({
  title,
  ...props
}: ComponentProps<"button"> & { title: string }) {
  return (
    <QuickTooltip label={title}>
      <Focusable>
        <button {...props} />
      </Focusable>
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
 * ignores touch hover and positions the portal outside clipping containers. */
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
      <Tooltip className={styles.tooltip} placement="bottom" offset={8}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}
