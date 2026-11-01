# components/GuidePanel.tsx

Generated from web/src/components/GuidePanel.tsx; do not edit.

```tsx
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";
import type { StartGoal } from "../app/composerReads";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./EditorSplit.css";
import "./GoalGuide.css";
import { useText } from "../i18n";
import { guideText } from "../text/guide";

/** The started goal's guide beside the conversation, in the right-hand panel.
 * The steps are the authored instruction, not the agent's progress: the host
 * does not know where the agent is. */
export function GuidePanel({
  goal,
  page,
  titleRef,
  onClose,
}: {
  goal: StartGoal;
  /** The start page's title, as the guide's eyebrow. */
  page: string;
  titleRef?: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const t = useText(guideText);
  const keyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape from the panel's own controls closes it, as in the view panel.
    <section
      className="ah-view-pane ah-guide-panel"
      aria-label={t.guideFor(goal.title)}
      data-testid="guide-panel"
      onKeyDown={keyDown}
    >
      <header className="ah-editor-header">
        <h2 ref={titleRef} tabIndex={-1} className="ah-view-title">
          {t.guide}
        </h2>
        <span className="ah-editor-controls">
          <ControlButton
            data-testid="guide-panel-close"
            size="row"
            variant="quiet"
            aria-label={t.close}
            title={t.close}
            onPress={onClose}
          >
            <Icon name="cross" />
          </ControlButton>
        </span>
      </header>
      <div className="ah-guide-panel-body">
        <p className="ah-guide-eyebrow">{t.eyebrow(page)}</p>
        <h3 className="ah-guide-panel-title">{goal.title}</h3>
        <section>
          <h4>{t.steps}</h4>
          <ol data-testid="guide-panel-steps">
            {goal.steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: authored ordered steps have no state.
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
        <section>
          <h4>{t.outcome}</h4>
          <p>{goal.what}</p>
        </section>
        <p className="ah-guide-panel-note">{t.note}</p>
      </div>
    </section>
  );
}

```
