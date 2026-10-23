import { useState } from "react";
import { AgentTurn, ThinkingRow, type TurnStep } from "../components/AgentTurn";
import { ControlButton } from "../components/ControlElements";
import { ConversationTimeline, UserMessage } from "../components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../components/ConversationFrame";
import { Markdown } from "../components/Markdown";
import { PiToolUse } from "../components/PiBlocks";

const noop = () => {};

/** Deterministic synthetic stream: empty text blocks can precede real deltas. */
export function StreamingActivityPreview() {
  const [phase, setPhase] = useState(0);
  const steps: TurnStep[] = [];
  if (phase >= 1)
    steps.push({
      kind: "thinking",
      key: "thought",
      node: <ThinkingRow text="Tarkistan tiedostot" live />,
    });
  for (let i = 0; i < Math.min(3, Math.max(0, phase - 1)); i++)
    steps.push({
      kind: "tool",
      key: `tool-${i}`,
      target: "ls",
      node: <PiToolUse name="bash" state="succeeded" targetText="ls" />,
    });
  if (phase >= 5 && phase !== 7) {
    const text =
      phase === 5
        ? ""
        : phase === 6
          ? "\n  "
          : phase === 8
            ? "Tarkistan"
            : "Tarkistan tuloksen.";
    steps.push({
      kind: "text",
      key: "answer",
      text,
      node: <Markdown text={text} />,
    });
  }
  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 16 }}>
      <ControlButton
        data-testid="stream-next"
        size="row"
        onPress={() => setPhase((p) => Math.min(9, p + 1))}
      >
        Seuraava päivitys
      </ControlButton>
      <div
        data-testid="stream-phase"
        data-phase={phase}
        style={{ height: 560 }}
      >
        <ConversationFrame>
          <ConversationStream>
            <ConversationTimeline
              state="ready"
              historyMode="pagedAccessible"
              onJumpToLatest={noop}
              items={[
                {
                  id: "user",
                  content: (
                    <UserMessage
                      sourceText="Tarkista tiedostot."
                      onCopy={noop}
                    />
                  ),
                },
                {
                  id: "turn",
                  content: (
                    <AgentTurn
                      working
                      activity={phase % 2 ? "Ajattelee" : "Ajaa bash"}
                      duration={phase % 2 ? "0:59" : "1:00"}
                      steps={steps}
                    />
                  ),
                },
              ]}
            />
          </ConversationStream>
        </ConversationFrame>
      </div>
    </main>
  );
}
