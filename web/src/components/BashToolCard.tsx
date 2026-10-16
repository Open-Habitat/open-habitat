import { useState } from "react";
import { type BashFailure, bashOutput } from "../app/bashFailure";
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
              {commandLines.length} riviä ·{" "}
              <ControlButton
                variant="quiet"
                size="compact"
                aria-expanded={commandOpen}
                onPress={() => setCommandOpen(!commandOpen)}
              >
                {commandOpen ? "Vain ensimmäinen rivi" : "Näytä koko komento"}
              </ControlButton>
            </div>
          ) : null}
        </div>
        <IconButton
          variant="quiet"
          aria-label={copied ? "Komento kopioitu" : "Kopioi komento"}
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
