# components/QuickTooltip.tsx

Generated from web/src/components/QuickTooltip.tsx; do not edit.

```tsx
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Focusable,
  Tooltip,
  TooltipContext,
  type TooltipProps,
  TooltipTrigger,
  TooltipTriggerStateContext,
  useContextProps,
} from "react-aria-components";
import { flushSync } from "react-dom";
import { useExplainState } from "./explainModeState";
import styles from "./QuickTooltip.module.css";

/** Where quick help opens. Below by default; beside the control, toward the
 * page, in the rail, whose rows are stacked so closely that help below a
 * row's small buttons would cover the next row's (Jari 7.11.2026). */
export const TooltipSide = createContext<"bottom" | "end">("bottom");

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
  const state = useContext(TooltipTriggerStateContext);
  const isOpen = state?.isOpen ?? false;
  const side = useContext(TooltipSide);
  // React Aria's open tooltip takes every Escape in the document, so help
  // that the resting pointer opened would swallow the key meant for the
  // focused element, such as the composer's stop. Escape elsewhere closes
  // it first, synchronously, and then reaches its target; Escape on the
  // trigger itself still only dismisses the help.
  useEffect(() => {
    if (!isOpen || !state) return;
    const onEscape = (event: KeyboardEvent) => {
      const trigger = props.triggerRef?.current;
      if (event.key !== "Escape") return;
      if (
        trigger &&
        event.target instanceof Node &&
        trigger.contains(event.target)
      )
        return;
      flushSync(() => state.close(true));
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [isOpen, state, props.triggerRef]);
  // Description linkage alone does not place a body-level portal in a landmark.
  // An aside with an explicit non-landmark role (offer cards use note) is
  // not a landmark and can be a narrow positioned containing block.
  const container =
    props.triggerRef?.current?.closest(
      'main, aside:not([role]), nav, [role="main"], [role="complementary"], [role="navigation"], [role="banner"], [role="contentinfo"]',
    ) ?? props.triggerRef?.current?.closest("header, footer");
  // Help has no exit animation, so it leaves the tree when it closes. Kept
  // mounted, React Aria's exit state sticks when one render both closes this
  // help and lets the next one replace it instantly (a slow page batches the
  // two), and the trigger's next Escape or press shows it again for good.
  if (!isOpen) return null;
  return (
    <Tooltip
      className={styles.tooltip}
      placement={side}
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
  const { on } = useExplainState();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (on) setOpen(false);
  }, [on]);
  return (
    <TooltipTrigger
      delay={250}
      closeDelay={100}
      isDisabled={on}
      isOpen={!on && open}
      onOpenChange={setOpen}
    >
      {children}
      <TooltipContent label={label} />
    </TooltipTrigger>
  );
}

```
