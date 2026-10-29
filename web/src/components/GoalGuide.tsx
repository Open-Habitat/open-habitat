import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { ControlButton } from "./ControlElements";
import "./GoalGuide.css";

/** Shared reading surface for authored guides and recorded skill instructions. */
export function GuideArticle({
  title: heading,
  eyebrow = "OPAS",
  action,
  children,
  onBack,
  backLabel = "← Kaikki tavoitteet",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
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
          {backLabel}
        </ControlButton>
      )}
      <p className="ah-guide-eyebrow">{eyebrow}</p>
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
