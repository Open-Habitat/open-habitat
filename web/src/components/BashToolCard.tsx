import { useState } from "react";
import { type BashFailure, bashOutput } from "../app/bashFailure";
import { useText } from "../i18n";
import { bashToolCardText } from "../text/bashToolCard";
import { ControlButton, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { OutputBox } from "./OutputBox";

export function BashToolCard({
  command,
  output,
  failureCause,
  running = false,
  onCopy,
}: {
  command: string;
  failureCause?: BashFailure;
  output?: string;
  running?: boolean;
  onCopy?: () => void;
}) {
  const t = useText(bashToolCardText);
  const [commandOpen, setCommandOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const commandLines = command.split("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="ah-bash-card">
      <div className="ah-bash-command-row">
        <div className="ah-bash-command">
          <pre>
            ${" "}
            {commandLines.length > 1 && !commandOpen
              ? commandLines[0]
              : command}
          </pre>
          {commandLines.length > 1 ? (
            <div className="ah-bash-command-toggle">
              {t.lines(commandLines.length)} ·{" "}
              <ControlButton
                variant="quiet"
                size="row"
                data-testid="command-disclosure"
                aria-expanded={commandOpen}
                onPress={() => setCommandOpen(!commandOpen)}
              >
                {commandOpen ? t.firstLineOnly : t.showAll}
              </ControlButton>
            </div>
          ) : null}
        </div>
        <IconButton
          size="inline"
          variant="quiet"
          data-testid="command-copy"
          aria-label={copied ? t.copied : t.copy}
          onPress={() => void copy()}
        >
          <Icon name={copied ? "check" : "copy"} />
        </IconButton>
      </div>
      {output !== undefined ? (
        <OutputBox
          text={bashOutput(output, failureCause) ?? ""}
          running={running}
          onCopy={onCopy}
        />
      ) : null}
    </div>
  );
}
