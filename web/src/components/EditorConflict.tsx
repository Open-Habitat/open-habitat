import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

export type MergeSource = "agent" | "disk";
export type ConflictPick = "mine" | "theirs" | "both";

/** The card above lines both the person and the disk changed. The person's
 * lines stay in the text below it, marked; the card shows the other side. */
export function EditorConflict({
  theirs,
  source,
  onPick,
}: {
  theirs: string[];
  source: MergeSource;
  onPick: (pick: ConflictPick) => void;
}) {
  const title =
    source === "agent"
      ? "Agentti muutti saman rivin"
      : "Sama rivi muuttui levyllä";
  const them = source === "agent" ? "Agentin" : "Levyn";
  return (
    <fieldset className="ah-merge-conflict" aria-label={title}>
      <p className="ah-merge-conflict-head">
        <strong>{title}</strong>
        <span>Sinun rivisi on alla punaisella. Valitse, mikä jää.</span>
      </p>
      <pre className="ah-merge-theirs" data-testid="conflict-theirs">
        <small>{them}</small>
        {theirs.join("\n") || "(rivi poistettu)"}
      </pre>
      <div className="ah-merge-actions">
        <ControlButton
          data-testid="pick-mine"
          size="row"
          onPress={() => onPick("mine")}
        >
          <Icon name="user" />
          Sinun
        </ControlButton>
        <ControlButton
          data-testid="pick-theirs"
          size="row"
          onPress={() => onPick("theirs")}
        >
          {source === "agent" ? <Icon name="agent" /> : <Icon name="disk" />}
          {them}
        </ControlButton>
        <ControlButton
          data-testid="pick-both"
          size="row"
          onPress={() => onPick("both")}
        >
          Molemmat
        </ControlButton>
      </div>
    </fieldset>
  );
}
