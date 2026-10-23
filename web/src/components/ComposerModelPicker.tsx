import { type ReactNode, useEffect, useRef } from "react";
import { ModelChip } from "./ModelChip";
import type { ModelChoice } from "./ModelPicker";
import "./ModelPicker.css";

/** A native disclosure: outside pointers dismiss without stealing their focus. */
export function ComposerModelPicker({
  thinking,
  models,
  model,
  children,
}: {
  thinking?: string;
  models?: ModelChoice[];
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
      <ModelChip
        as="summary"
        data-testid="composer-model-picker"
        model={model}
        thinking={thinking}
        models={models}
        className="md-pill"
        aria-label="Uuden keskustelun malli"
      />
      <div className="md-pop md-pop-up" data-testid="composer-model-menu">
        {children(close)}
      </div>
    </details>
  );
}
