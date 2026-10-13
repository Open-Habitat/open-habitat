import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ControlButton, IconButton } from "./ControlElements";
import { Icon, type IconName } from "./Icon";

const remembered = new Map<string, "edges" | "start" | "end" | "all">();
type View = "edges" | "start" | "end" | "all";
export function BashToolCard({
  command,
  output,
  running = false,
  onCopy,
}: {
  command: string;
  output?: string;
  running?: boolean;
  onCopy?: () => void;
}) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [choice, setChoice] = useState<View | undefined>(
    remembered.get("bash"),
  );
  const [dialog, setDialog] = useState(false);
  const viewport = useRef<HTMLPreElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog || !dialogRef.current) return;
    if (typeof dialogRef.current.showModal === "function")
      dialogRef.current.showModal();
    else dialogRef.current.setAttribute("open", ""); // jsdom lacks showModal
  }, [dialog]);
  const lines = output?.split("\n") ?? [];
  const long = lines.length > 10;
  const view = running ? "end" : (choice ?? "edges");
  useLayoutEffect(() => {
    // The changing output is the signal to follow the newest streamed line.
    if (output !== undefined && viewport.current && (view === "end" || running))
      viewport.current.scrollTop = viewport.current.scrollHeight;
    else if (viewport.current && view === "start")
      viewport.current.scrollTop = 0;
  }, [view, output, running]);
  const select = (next: View) => {
    remembered.set("bash", next);
    setChoice(next);
  };
  const commandLines = command.split("\n");
  return (
    <div className="ah-bash-card">
      <div className="ah-bash-command">
        <pre>
          ${" "}
          {commandLines.length > 1 && !commandOpen ? commandLines[0] : command}
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
      {output !== undefined ? (
        <div className="ah-bash-output">
          <div className="ah-bash-window">
            {long && view === "edges" && !running ? (
              <div>
                <pre className="ah-bash-head">
                  {lines.slice(0, 3).join("\n")}
                </pre>
                <ControlButton
                  variant="quiet"
                  className="ah-bash-gap"
                  onPress={() => select("all")}
                >
                  {lines.length - 10} riviä välistä · Näytä kaikki
                </ControlButton>
                <pre className="ah-bash-tail">{lines.slice(-7).join("\n")}</pre>
              </div>
            ) : (
              <pre
                ref={viewport}
                className={view === "all" ? "ah-bash-all" : ""}
              >
                {output}
                {running ? (
                  <span className="ah-bash-caret" aria-hidden="true">
                    ▏
                  </span>
                ) : null}
              </pre>
            )}
            {long ? (
              <fieldset className="ah-bash-rail" aria-label="Tulosteen näkymä">
                {(
                  [
                    ["edges", "Alku ja loppu", "edges"],
                    ["start", "Alkuun", "top"],
                    ["end", "Loppuun", "bottom"],
                    ["all", "Näytä kaikki", "expand"],
                  ] as const
                ).map(([value, label, icon]) => (
                  <IconButton
                    variant="quiet"
                    key={value}
                    aria-label={label}
                    aria-pressed={view === value}
                    onPress={() => select(value)}
                  >
                    <Icon name={icon as IconName} />
                  </IconButton>
                ))}
                <IconButton
                  variant="quiet"
                  aria-label="Avaa omassa ikkunassa"
                  onPress={() => setDialog(true)}
                >
                  <Icon name="external" />
                </IconButton>
              </fieldset>
            ) : null}
          </div>
          {long ? <small>{lines.length} riviä</small> : null}
        </div>
      ) : null}
      {dialog ? (
        <dialog
          ref={dialogRef}
          onClose={() => setDialog(false)}
          className="ah-bash-dialog"
          aria-label="bash-tuloste"
        >
          <header>
            <strong>bash</strong>
            <ControlButton
              variant="quiet"
              size="compact"
              onPress={() => {
                if (onCopy) onCopy();
                else void navigator.clipboard?.writeText(output ?? "");
              }}
            >
              Kopioi
            </ControlButton>
            <ControlButton
              variant="quiet"
              size="compact"
              onPress={() => {
                dialogRef.current?.close?.();
                setDialog(false);
              }}
            >
              Sulje
            </ControlButton>
          </header>
          <pre>
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Line number is the stable identity within this output.
              <code key={i}>
                <span>{i + 1}</span>
                {line || " "}
                {"\n"}
              </code>
            ))}
          </pre>
        </dialog>
      ) : null}
    </div>
  );
}
