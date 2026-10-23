import { type ReactNode, useEffect, useRef } from "react";
import { controlClassName } from "./ControlElements";
import { Icon } from "./Icon";
import "./ModelPicker.css";

/** A native disclosure: outside pointers dismiss without stealing their focus. */
export function ComposerModelPicker({
  label,
  model,
  children,
}: {
  label: ReactNode;
  model?: string;
  children: (close: () => void) => ReactNode;
}) {
  const picker = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (!picker.current) return;
    picker.current.open = false;
    picker.current.querySelector("summary")?.focus();
  };
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const element = picker.current;
      if (element?.open && !event.composedPath().includes(element))
        element.open = false;
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, []);
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape dismisses the native disclosure and restores its trigger focus.
    <details
      className="md-empty-picker"
      ref={picker}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <summary
        data-testid="composer-model-picker"
        data-model={model}
        className={`md-pill ${controlClassName({ size: "inline", presentation: "pill" })}`}
        aria-label="Uuden keskustelun malli"
      >
        {label} <Icon name="down" />
      </summary>
      <div className="md-pop md-pop-up" data-testid="composer-model-menu">
        {children(close)}
      </div>
    </details>
  );
}
