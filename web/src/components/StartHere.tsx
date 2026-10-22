import { useLayoutEffect, useRef, useState } from "react";
import type { StartGoal, StartPage } from "../app/composerReads";
import { ControlButton } from "./ControlElements";
import { GoalGuide } from "./GoalGuide";
import { Markdown } from "./Markdown";
import "./StartHere.css";

export function goalDraft(goal: StartGoal, draft: string) {
  const prompt = goal.skill
    ? `/skill:${goal.skill} ${goal.prompt}`
    : goal.prompt;
  return `${[
    prompt.replace(/\n+$/, ""),
    draft.trim() ? draft.replace(/\n+$/, "") : undefined,
  ]
    .filter((part) => part !== undefined)
    .join("\n\n")}\n\n`;
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
  const authored = page && !("state" in page) ? page : null;
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (state === "ready" && page)
      root.current?.scrollIntoView?.({ block: "start" });
  }, [state, page]);
  const [selected, setSelected] = useState<number | null>(null);
  const links = useRef<(HTMLButtonElement | null)[]>([]);
  const goal = selected === null ? undefined : authored?.goals[selected];
  const back = () => {
    const previous = selected;
    setSelected(null);
    requestAnimationFrame(() => {
      if (previous !== null) links.current[previous]?.focus();
    });
  };
  return (
    <section ref={root} className="ah-start" data-testid="start-here">
      {state === "loading" ? (
        <p role="status">Luetaan aloitussivua…</p>
      ) : state === "error" ? (
        <div role="status">
          <p>Aloitussivua ei saatu luettua.</p>
          <ControlButton size="row" onPress={onRetry}>
            Yritä uudelleen
          </ControlButton>
        </div>
      ) : goal ? (
        <GoalGuide
          goal={goal}
          onBack={back}
          onStart={() => {
            setSelected(null);
            onGoal(goal);
          }}
        />
      ) : page && "state" in page ? (
        <div role="status" data-testid="start-page-needs-update">
          <h2>Aloitussivu tarvitsee päivityksen</h2>
          <p>
            Päivitä aloitussivu kirjoittamalla viestikenttään{" "}
            <code>/skill:open-habitat-start-page</code>. Voit myös jatkaa
            kirjoittamalla agentille omin sanoin.
          </p>
        </div>
      ) : authored ? (
        <>
          <h2 data-testid="start-page-title">{authored.title}</h2>
          <div data-testid="start-page-body">
            <Markdown text={authored.body} />
          </div>
          {authored.goals.length > 0 && (
            <h3 className="ah-start-heading">Mitä haluat tehdä?</h3>
          )}
          <div className="ah-start-goals">
            {authored.goals.map((goal, index) => (
              <button
                type="button"
                className="ah-start-goal"
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered authored goals have no row state.
                key={index}
                ref={(node) => {
                  links.current[index] = node;
                }}
                data-testid="starting-goal"
                onClick={() => setSelected(index)}
              >
                <strong>{goal.title}</strong>
                <span>{goal.when}</span>
                <b aria-hidden="true">→</b>
              </button>
            ))}
          </div>
          {authored.goals.length > 0 && (
            <p className="ah-start-hint">
              Tavoite avaa oman oppaan. Voit myös kirjoittaa suoraan agentille.
            </p>
          )}
        </>
      ) : (
        <p className="ah-start-hint" data-testid="start-page-hint">
          Luo aloitussivu kirjoittamalla viestikenttään{" "}
          <code>/skill:open-habitat-start-page</code>.
        </p>
      )}
    </section>
  );
}
