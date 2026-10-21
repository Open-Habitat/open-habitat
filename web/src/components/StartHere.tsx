import type { StartGoal, StartPage } from "../app/composerReads";
import { ControlButton } from "./ControlElements";
import { Markdown } from "./Markdown";
import "./StartHere.css";

export function goalDraft(goal: StartGoal, draft: string) {
  const args = [goal.prompt, draft.trim() ? draft : undefined]
    .filter(Boolean)
    .join("\n\n");
  return goal.skill ? `/skill:${goal.skill} ${args}` : args;
}

/** Only the repository's authored page; no automatically discovered cards. */
export function StartHere({
  page,
  state,
  onRetry,
  onGoal,
}: {
  page?: StartPage | null;
  state: "loading" | "ready" | "error";
  onRetry: () => void;
  onGoal: (goal: StartGoal) => void;
}) {
  return (
    <section className="ah-start" data-testid="start-here">
      {state === "loading" ? (
        <p role="status">Luetaan aloitussivua…</p>
      ) : state === "error" ? (
        <div role="status">
          <p>Aloitussivua ei saatu luettua.</p>
          <ControlButton size="row" onPress={onRetry}>
            Yritä uudelleen
          </ControlButton>
        </div>
      ) : page ? (
        <>
          <h2 data-testid="start-page-title">{page.title}</h2>
          <div data-testid="start-page-body">
            <Markdown text={page.body} />
          </div>
          <div className="ah-start-goals">
            {page.goals.map((goal, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: page-defined positions; static articles have no local state.
              <article key={index}>
                <h3>{goal.title}</h3>
                <p>{goal.when}</p>
                <blockquote>{goal.prompt}</blockquote>
                <ControlButton
                  size="row"
                  data-testid="starting-goal"
                  aria-label={`${goal.title} — kokeile luonnoksessa`}
                  onPress={() => onGoal(goal)}
                >
                  Kokeile luonnoksessa
                </ControlButton>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="ah-start-hint" data-testid="start-page-hint">
          Luo repon <code>.agents/start-page.md</code> taidolla{" "}
          <code>/skill:open-habitat-start-page</code>.
        </p>
      )}
    </section>
  );
}
