import { useId, useLayoutEffect, useRef } from "react";
import type { StartGoal } from "../app/composerReads";
import { ControlButton } from "./ControlElements";
import "./GoalGuide.css";

/** Authored reading content and draft intent, shared with guide panels. */
export function GoalGuide({
  goal,
  onStart,
  onBack,
}: {
  goal: StartGoal;
  onStart: () => void;
  onBack?: () => void;
}) {
  const article = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    title.current?.focus({ preventScroll: true });
    article.current?.scrollIntoView?.({ block: "start" });
  }, []);
  const start = (testId: string) => (
    <ControlButton
      size="page"
      variant="primary"
      data-testid={testId}
      onPress={onStart}
    >
      Aloita
    </ControlButton>
  );
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
          ← Kaikki tavoitteet
        </ControlButton>
      )}
      <p className="ah-guide-eyebrow">OPAS</p>
      <header className="ah-guide-heading">
        <h2 id={id} ref={title} tabIndex={-1} data-testid="guide-title">
          {goal.title}
        </h2>
        {start("guide-start-top")}
      </header>
      <section>
        <h3>Mitä saat</h3>
        <p>{goal.what}</p>
      </section>
      <section>
        <h3>Milloin käytät</h3>
        <p>{goal.when}</p>
      </section>
      <section>
        <h3>Näin etenet</h3>
        <ol>
          {goal.steps.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: authored ordered steps have no state.
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>
      <details className="ah-guide-disclosure" data-testid="guide-request">
        <summary>Näytä agentille annettava pyyntö</summary>
        <pre
          className="ah-guide-prompt"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must scroll the bounded full request.
          tabIndex={0}
          data-testid="guide-prompt"
        >
          {goal.skill ? `/skill:${goal.skill} ` : ""}
          {goal.prompt}
        </pre>
      </details>
      <footer className="ah-guide-actions">
        {start("guide-start-bottom")}
        <p>
          Pyyntö lisätään luonnokseen. Voit muokata sitä ennen lähettämistä.
        </p>
      </footer>
    </article>
  );
}
