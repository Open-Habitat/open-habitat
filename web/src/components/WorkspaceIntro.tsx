import { useState } from "react";
import type { StartGoal, StartPage } from "../app/composerReads";
import { useText } from "../i18n";
import { startHereText } from "../text/startHere";
import { ControlButton } from "./ControlElements";
import { Markdown } from "./Markdown";
import { StartGoals } from "./StartHere";
import "./StartHere.css";
import "./WorkspaceIntro.css";

/** The body's first paragraph, and whether more follows. A blank line inside
 * a code fence does not end it. */
export function firstParagraph(body: string) {
  const lines = body.trim().split("\n");
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fenced = !fenced;
    if (!fenced && !lines[i].trim())
      return {
        first: lines.slice(0, i).join("\n"),
        more: lines.slice(i).some((line) => line.trim()),
      };
  }
  return { first: lines.join("\n"), more: false };
}

/**
 * The workspace page's Esittely: the repository's authored start page, the
 * same `.agents/start-page.md` a new conversation shows. Its first paragraph
 * is the repository's description; a goal starts a new conversation with
 * its request already in the field.
 */
export function WorkspaceIntro({
  page,
  state,
  onRetry,
  onGoal,
  preparing,
  disabled,
  onCreatePage,
}: {
  page?: StartPage | null;
  state: "loading" | "ready" | "error";
  onRetry: () => void;
  onGoal: (goal: StartGoal) => void;
  /** The goal whose new conversation is being prepared. */
  preparing?: StartGoal;
  /** Why no conversation can be started now. */
  disabled?: string;
  /** Starts a conversation that writes or updates the start page. */
  onCreatePage: () => void;
}) {
  const t = useText(startHereText);
  const [open, setOpen] = useState(false);
  if (state === "loading") return null;
  if (state === "error")
    return (
      <div className="ah-workspace-intro-line" role="status">
        <p>{t.unreadable}</p>
        <ControlButton size="row" variant="quiet" onPress={onRetry}>
          {t.retry}
        </ControlButton>
      </div>
    );
  if (!page || "state" in page)
    return (
      <div
        className="ah-workspace-intro-line"
        data-testid={page ? "landing-needs-update" : "landing-absent"}
      >
        <p>{page ? t.introNeedsUpdate : t.introAbsent}</p>
        <ControlButton
          size="row"
          variant="secondary"
          data-testid="landing-create"
          isDisabled={!!disabled}
          onPress={onCreatePage}
        >
          {page ? t.updatePage : t.createPage}
        </ControlButton>
      </div>
    );
  const { first, more } = firstParagraph(page.body);
  return (
    <section
      className="ah-start ah-workspace-intro"
      aria-label={t.pageLabel}
      data-testid="landing"
    >
      <h2 data-testid="landing-title">{page.title}</h2>
      <div className="ah-workspace-intro-body" data-testid="landing-body">
        <Markdown text={open ? page.body : first} />
      </div>
      {more ? (
        <ControlButton
          size="inline"
          variant="quiet"
          data-testid="landing-more"
          aria-expanded={open}
          onPress={() => setOpen(!open)}
        >
          {open ? t.showLess : t.showAll}
        </ControlButton>
      ) : null}
      {page.goals.length > 0 ? (
        <>
          <h3 className="ah-start-heading">{t.whatToDo}</h3>
          <StartGoals
            goals={page.goals}
            onGoal={onGoal}
            preparing={preparing}
            disabled={disabled}
          />
          <p className="ah-start-hint">{t.introGoalHint(t.newHint)}</p>
        </>
      ) : null}
    </section>
  );
}
