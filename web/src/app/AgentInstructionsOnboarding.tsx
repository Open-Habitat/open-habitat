import { useState } from "react";
import { AgentNoteStep } from "../components/AgentNoteStep";
import { OnboardingFrame } from "../components/OnboardingFrame";
import { Button } from "../components/Primitives";
import { InlineNotice } from "../components/Status";
import { useLanguage, useText } from "../i18n";
import { agentInstructionsText } from "../text/agentInstructions";
import { browserAnswerLanguage } from "./answerLanguage";
import { useAgentInstructions } from "./useAgentInstructions";
import "./AgentInstructions.css";

export type InstructionsOutcome = "saved" | "merged" | "later" | "kept";

/** Onboarding's last step (issue new-user-agent-instructions-template,
 * A4.1; experimental agent-instructions): the note for the agent, written by
 * the page through the daemon's compare-and-swap write, then one plain
 * sentence with the technical facts folded away. Nothing is written by
 * "Tee myöhemmin" or "Jätä ennalleen". */
export function AgentInstructionsOnboarding({
  csrf,
  name,
  languageChosen,
  onOutcome,
  onDone,
}: {
  csrf?: string;
  name: string;
  /** The person chose Habitat's language rather than "system". */
  languageChosen: boolean;
  /** The step's result, for the route's note beside it. */
  onOutcome: (outcome: InstructionsOutcome) => void;
  onDone: () => void;
}) {
  const t = useText(agentInstructionsText);
  const language = useLanguage();
  const { state, save } = useAgentInstructions(csrf);
  const [outcome, setOutcome] = useState<InstructionsOutcome>();
  const [written, setWritten] = useState("");
  const end = (o: InstructionsOutcome, text = "") => {
    setWritten(text);
    setOutcome(o);
    onOutcome(o);
  };
  const enter = (
    <Button
      data-testid="enter-habitat"
      size="row"
      variant="primary"
      label={t.enter}
      onPress={onDone}
    />
  );
  if (outcome) {
    const wrote = outcome === "saved" || outcome === "merged";
    return (
      <OnboardingFrame step="done">
        <section
          className="ah-onboarding-step"
          data-testid="route-done"
          data-outcome={outcome}
          aria-labelledby="ai-done-title"
        >
          <header>
            <h1 id="ai-done-title" tabIndex={-1}>
              {outcome === "saved"
                ? t.doneSaved
                : outcome === "merged"
                  ? t.doneMerged
                  : outcome === "later"
                    ? t.doneLater
                    : t.doneKept}
            </h1>
            <p>
              {wrote
                ? t.doneSavedLead
                : outcome === "later"
                  ? t.doneLaterLead
                  : t.doneKeptLead}
            </p>
          </header>
          {wrote ? (
            <details className="an-where" data-testid="where">
              <summary>{t.where}</summary>
              <p>{t.whereText}</p>
              <pre className="an-written" data-testid="written-file">
                {written}
              </pre>
            </details>
          ) : null}
          <div className="ah-onboarding-actions">
            <span />
            {enter}
          </div>
        </section>
      </OnboardingFrame>
    );
  }
  if (state.phase !== "ready")
    return (
      <OnboardingFrame step="instructions">
        <section className="ah-onboarding-step" data-testid="instructions-step">
          {state.phase === "loading" ? (
            <p role="status">{t.loading}</p>
          ) : (
            <>
              <InlineNotice
                data-testid="instructions-error"
                title={
                  state.code === "file_unsupported"
                    ? t.unsupported
                    : state.code === "file_too_large"
                      ? t.tooLarge
                      : t.readError
                }
                tone="warning"
              />
              <div className="ah-onboarding-actions">
                <span />
                {enter}
              </div>
            </>
          )}
        </section>
      </OnboardingFrame>
    );
  const existing = state.file.exists ? state.file.content : undefined;
  return (
    <OnboardingFrame step="instructions">
      <AgentNoteStep
        name={name}
        defaultLanguage={browserAnswerLanguage(
          language.startsWith("en") ? "en" : "fi",
          languageChosen,
        )}
        existing={existing}
        onLater={() => end(existing === undefined ? "later" : "kept")}
        onSave={async (text) => {
          const result = await save(text);
          if ("ok" in result)
            end(existing === undefined ? "saved" : "merged", text);
          return result;
        }}
      />
    </OnboardingFrame>
  );
}
