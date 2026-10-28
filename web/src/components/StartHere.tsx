import { useLayoutEffect, useRef, useState } from "react";
import type { StartGoal, StartPage } from "../app/composerReads";
import { ControlButton } from "./ControlElements";
import { GoalGuide } from "./GoalGuide";
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

/** Only the repository's authored page; no automatically discovered cards. */
export function StartHere({
  page,
  state,
  onRetry,
  onGoal,
  preparing = false,
}: {
  preparing?: boolean;
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
        <div className="ah-start-placeholder" aria-busy="true" />
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
          preparing={preparing}
          onBack={back}
          onStart={() => {
            onGoal(goal);
          }}
        />
      ) : page && "state" in page ? (
        <div role="status" data-testid="start-page-needs-update">
          <h2>Aloitussivu tarvitsee päivityksen</h2>
          <p>
            Päivitä aloitussivu kirjoittamalla viestikenttään{" "}
            <code>/open-habitat-start-page</code>. Voit myös jatkaa
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
          <code>/open-habitat-start-page</code>.
        </p>
      )}
    </section>
  );
}
