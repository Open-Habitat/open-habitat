import { useLayoutEffect, useRef } from "react";
import type { StartGoal, StartPage } from "../app/composerReads";
import { useText } from "../i18n";
import { startPageRequestText } from "../text/startPageRequest";
import "./WorkspaceIntro.css";
import { startHereText } from "../text/startHere";
import { ControlButton } from "./ControlElements";
import { ExplainStrip } from "./ExplainMode";
import { Markdown } from "./Markdown";
import "./StartHere.css";

/** The authored request without its one editable placeholder, and the
 * placeholder itself. */
export function goalRequest(goal: StartGoal) {
  // Ambiguous/malformed brackets stay literal: never guess which input to replace.
  const brackets = goal.prompt.match(/\[[^[\]\r\n]+\]/g) ?? [];
  const placeholder =
    brackets.length === 1 &&
    !/[[\]]/.test(goal.prompt.replace(brackets[0], "")) &&
    brackets[0].slice(1, -1).trim()
      ? brackets[0]
      : undefined;
  const request = placeholder
    ? goal.prompt.replace(placeholder, "").trim()
    : goal.prompt.replace(/\n+$/, "");
  return { request, placeholder };
}

/** Immediate start is opt-in, and never consumes input the person must edit. */
export function goalStartsImmediately(goal: StartGoal, draft: string) {
  return (
    goal.start === "immediate" &&
    !draft.trim() &&
    !goalRequest(goal).placeholder
  );
}

/** The draft Aloita prepares. A goal's own skill (`carried`) already holds
 * the request, so only the invocation, the person's draft and the
 * placeholder go into the field; Pi records the request with the skill. */
export function goalDraft(goal: StartGoal, draft: string, carried = false) {
  const { request, placeholder } = goalRequest(goal);
  // Pi reads the skill name up to the first space, so the space is the separator.
  const invocation = goal.skill ? `/skill:${goal.skill} ` : "";
  const body = [
    carried && goal.skill ? undefined : request,
    draft.trim() ? draft.replace(/\n+$/, "") : undefined,
    placeholder,
  ]
    .filter((part) => part !== undefined && part !== "")
    .join("\n\n");
  const text = invocation + body + (placeholder || !body ? "" : "\n\n");
  return {
    text,
    selectionStart: text.length - (placeholder?.length ?? 0),
    selectionEnd: text.length,
  };
}

/** A start page's goal cards: choosing one is its Aloita. The draft is
 * prepared at once and the guide opens beside the conversation; there is no
 * reading stop before it (Jari 29.10.2026). */
export function StartGoals({
  goals,
  onGoal,
  preparing,
  disabled,
}: {
  goals: StartGoal[];
  onGoal: (goal: StartGoal) => void;
  /** The goal whose skill is being checked. */
  preparing?: StartGoal;
  /** Why no goal can start a conversation now. */
  disabled?: string;
}) {
  return (
    <div className="ah-start-goals">
      {goals.map((goal, index) => (
        <button
          type="button"
          className="ah-start-goal"
          // biome-ignore lint/suspicious/noArrayIndexKey: ordered authored goals have no row state.
          key={index}
          data-testid="starting-goal"
          aria-busy={preparing === goal || undefined}
          aria-disabled={!!preparing || !!disabled || undefined}
          title={disabled}
          onClick={() => {
            if (!preparing && !disabled) onGoal(goal);
          }}
        >
          <strong>{goal.title}</strong>
          <span>{goal.when}</span>
          <b aria-hidden="true">→</b>
        </button>
      ))}
    </div>
  );
}

/** Only the repository's authored page; no automatically discovered cards. */
export function StartHere({
  page,
  state,
  onRetry,
  onGoal,
  preparing,
  onCreatePage,
}: {
  onCreatePage?: () => void;
  preparing?: StartGoal;
  page?: StartPage | null;
  state: "loading" | "ready" | "error";
  onRetry: () => void;
  onGoal: (goal: StartGoal) => void;
}) {
  const t = useText(startHereText);
  const request = useText(startPageRequestText);
  const authored = page && !("state" in page) ? page : null;
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (state === "ready" && page)
      root.current?.scrollIntoView?.({ block: "start" });
  }, [state, page]);
  return (
    <section ref={root} className="ah-start" data-testid="start-here">
      <ExplainStrip />
      {state === "loading" ? (
        <div className="ah-start-placeholder" aria-busy="true" />
      ) : state === "error" ? (
        <div role="status">
          <p>{t.unreadable}</p>
          <ControlButton size="row" onPress={onRetry}>
            {t.retry}
          </ControlButton>
        </div>
      ) : page && "state" in page ? (
        <div role="status" data-testid="start-page-needs-update">
          <h2>{t.needsUpdateTitle}</h2>
          <p>{t.needsUpdate}</p>
        </div>
      ) : authored ? (
        <>
          <h2 data-testid="start-page-title">{authored.title}</h2>
          <div data-testid="start-page-body">
            <Markdown text={authored.body} />
          </div>
          {authored.goals.length > 0 && (
            <>
              <h3 className="ah-start-heading">{t.whatToDo}</h3>
              <StartGoals
                goals={authored.goals}
                onGoal={onGoal}
                preparing={preparing}
              />
              <p className="ah-start-hint">{t.goalHint}</p>
            </>
          )}
        </>
      ) : onCreatePage ? (
        <div
          className="ah-workspace-intro-line"
          data-testid="start-page-invitation"
        >
          <p>{request.invitation}</p>
          <ControlButton
            size="row"
            variant="secondary"
            data-testid="start-page-create"
            onPress={onCreatePage}
          >
            {request.create}
          </ControlButton>
        </div>
      ) : (
        <p className="ah-start-hint" data-testid="start-page-hint">
          {t.create}
        </p>
      )}
    </section>
  );
}
