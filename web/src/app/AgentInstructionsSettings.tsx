import { type ReactNode, useState } from "react";
import { AgentNoteStep } from "../components/AgentNoteStep";
import { ControlButton } from "../components/ControlElements";
import { InstructionsEditor } from "../components/InstructionsEditor";
import { InlineNotice } from "../components/Status";
import { currentLanguage, useLanguage, useText } from "../i18n";
import { agentInstructionsText } from "../text/agentInstructions";
import { useLanguageChosen } from "./accountPreferences";
import type { ClaudeReads } from "./agentInstructions";
import { browserAnswerLanguage } from "./answerLanguage";
import { useAgentInstructions } from "./useAgentInstructions";
import "./AgentInstructions.css";

const PI_FILE = "~/.pi/agent/AGENTS.md";

/** Settings › Tili › Ohjeet agentille (issue
 * new-user-agent-instructions-template, B1): the person's instructions file
 * in the shared editor, opening in Esikatselu, with "Muokkaa agentin
 * kanssa" as the secondary action. That action opens the same note
 * conversation as onboarding's last step; it adds to an existing note and
 * never rewrites it. Experimental (agent-instructions). */
export function AgentInstructionsSettings({
  csrf,
  name,
}: {
  csrf?: string;
  name: string;
}) {
  const t = useText(agentInstructionsText);
  const language = useLanguage();
  const languageChosen = useLanguageChosen();
  const { state, save, retry } = useAgentInstructions(csrf);
  const [withAgent, setWithAgent] = useState(false);
  let body: ReactNode;
  if (state.phase === "loading")
    body = (
      <p className="s-desc" role="status">
        {t.loading}
      </p>
    );
  else if (state.phase === "error")
    body = (
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
        actions={
          state.code === "file_unsupported" || state.code === "file_too_large"
            ? []
            : [{ label: t.retry, onPress: retry }]
        }
      />
    );
  else if (withAgent) {
    const ui = language.startsWith("en") ? "en" : "fi";
    body = (
      <AgentNoteStep
        settings
        name={name}
        defaultLanguage={browserAnswerLanguage(ui, languageChosen)}
        existing={state.file.exists ? state.file.content : undefined}
        onLater={() => {
          // The editor starts again from the file as it is now, never from
          // a read older than the version the next save names.
          setWithAgent(false);
          retry();
        }}
        onSave={async (text) => {
          const result = await save(text);
          if ("ok" in result) setWithAgent(false);
          return result;
        }}
      />
    );
  } else {
    const { file } = state;
    body = (
      <InstructionsEditor
        data-testid="instructions-editor"
        value={file.content}
        label={t.editorLabel}
        onSave={save}
        empty={
          <>
            <strong>{t.emptyTitle}</strong>
            <p>{t.emptyLead}</p>
          </>
        }
        source={<Source modified={file.modified} claude={file.claude} />}
        secondary={
          <ControlButton
            data-testid="instructions-with-agent"
            size="row"
            variant={
              file.exists && file.content.trim() ? "secondary" : "primary"
            }
            onPress={() => {
              setWithAgent(true);
              retry();
            }}
          >
            {file.exists && file.content.trim()
              ? t.editWithAgent
              : t.writeWithAgent}
          </ControlButton>
        }
      />
    );
  }
  return (
    <div
      className="ai-settings"
      data-settings-row="instructions"
      data-testid="agent-instructions-settings"
      tabIndex={-1}
    >
      {withAgent ? null : <p className="s-intro">{t.intro}</p>}
      {body}
    </div>
  );
}

function Source({
  modified,
  claude,
}: {
  modified: string | null;
  claude: ClaudeReads;
}) {
  const t = useText(agentInstructionsText);
  const date = modified
    ? new Intl.DateTimeFormat(currentLanguage(), {
        dateStyle: "medium",
      }).format(new Date(modified))
    : undefined;
  return (
    <div
      className="ai-source"
      data-testid="instructions-source"
      data-claude={claude}
    >
      <p>
        {t.file} <code>{PI_FILE}</code> · {date ? t.modified(date) : t.notYet}
      </p>
      <p>
        {t.pi}{" "}
        {claude === "imports"
          ? t.claudeImports
          : claude === "own"
            ? t.claudeOwn
            : claude === "none"
              ? t.claudeNone
              : t.claudeUnknown}
      </p>
    </div>
  );
}
