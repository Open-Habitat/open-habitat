import { useRef, useState } from "react";
import type { CheckedStartPage } from "../app/startPageCheck";
import { useText } from "../i18n";
import { editorContentPreviewText } from "../text/editorContentPreview";
import { Markdown } from "./Markdown";
import { WorkspaceIntro } from "./WorkspaceIntro";

const noop = () => {};
export default function StartPagePreview({ page }: { page: CheckedStartPage }) {
  const t = useText(editorContentPreviewText);
  const guides = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(-1);
  return (
    <div className="ah-start-page-preview" data-testid="start-page-preview">
      <WorkspaceIntro
        page={page}
        state="ready"
        onRetry={noop}
        onCreatePage={noop}
        previewHint={t.goalHint}
        onGoal={(goal) => {
          const i = page.goals.indexOf(goal);
          setActive(i);
          guides.current[i]?.scrollIntoView({ block: "start" });
          guides.current[i]?.focus({ preventScroll: true });
        }}
      />
      {page.goals.length ? (
        <>
          <h3>{t.guides}</h3>
          <ol
            className="ah-start-page-guides"
            data-testid="preview-goal-guides"
          >
            {page.goals.map((goal, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: goals are an ordered, immutable preview of the buffer.
                key={i}
                ref={(node) => {
                  guides.current[i] = node;
                }}
                tabIndex={-1}
                data-active={active === i || undefined}
              >
                <h4>{goal.title}</h4>
                {(goal.guide !== "none" || goal.skill || goal.name) && (
                  <dl>
                    {goal.guide !== "none" && (
                      <>
                        <dt>{t.when}</dt>
                        <dd>{goal.when}</dd>
                        <dt>{t.what}</dt>
                        <dd>{goal.what}</dd>
                        <dt>{t.steps}</dt>
                        <dd>
                          <ol>
                            {goal.steps?.map((step, n) => (
                              <li
                                // biome-ignore lint/suspicious/noArrayIndexKey: authored source order.
                                key={n}
                              >
                                {step}
                              </li>
                            ))}
                          </ol>
                        </dd>
                      </>
                    )}
                    {goal.skill ? (
                      <>
                        <dt>{t.skill}</dt>
                        <dd>
                          <code>{goal.skill}</code>
                        </dd>
                      </>
                    ) : null}
                    {goal.name ? (
                      <>
                        <dt>{t.name}</dt>
                        <dd>{goal.name}</dd>
                      </>
                    ) : null}
                  </dl>
                )}
                <h5>{t.prompt}</h5>
                <Markdown text={goal.prompt} />
                {goal.start === "immediate" ? <p>{t.immediate}</p> : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
