import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { ControlButton } from "./ControlElements";
import "./GoalGuide.css";
import { useText } from "../i18n";
import { guideText } from "../text/guide";

/** Shared reading surface for authored guides and recorded skill instructions. */
export function GuideArticle({
  title: heading,
  eyebrow,
  action,
  children,
  onBack,
  backLabel,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  const t = useText(guideText);
  const article = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    title.current?.focus({ preventScroll: true });
    article.current?.scrollIntoView?.({ block: "start" });
  }, []);
  return (
    <article
      ref={article}
      className="ah-goal-guide"
      aria-labelledby={id}
      data-testid="goal-guide"
    >
      {onBack && (
        <ControlButton
          size="row"
          presentation="back"
          data-testid="guide-back"
          onPress={onBack}
        >
          {backLabel ?? t.allGoals}
        </ControlButton>
      )}
      <p className="ah-guide-eyebrow">{eyebrow ?? t.guideEyebrow}</p>
      <header className="ah-guide-heading">
        <h2 id={id} ref={title} tabIndex={-1} data-testid="guide-title">
          {heading}
        </h2>
        {action}
      </header>
      {children}
    </article>
  );
}
