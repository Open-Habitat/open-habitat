import { useText } from "../i18n";
import { editorConflictText } from "../text/editorConflict";
import { ControlButton } from "./ControlElements";
import type { MergeSource } from "./editorMerge";
import { Icon } from "./Icon";

export type { MergeSource };
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
  const t = useText(editorConflictText);
  const title = source === "agent" ? t.agentChanged : t.diskChanged;
  const them = source === "agent" ? t.agents : t.disks;
  return (
    <fieldset className="ah-merge-conflict" aria-label={title}>
      <p className="ah-merge-conflict-head">
        <strong>{title}</strong>
        <span>{t.yoursBelow}</span>
      </p>
      <pre className="ah-merge-theirs" data-testid="conflict-theirs">
        <small>{them}</small>
        {theirs.join("\n") || t.lineDeleted}
      </pre>
      <div className="ah-merge-actions">
        <ControlButton
          data-testid="pick-mine"
          size="row"
          onPress={() => onPick("mine")}
        >
          <Icon name="user" />
          {t.yours}
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
          {t.both}
        </ControlButton>
      </div>
    </fieldset>
  );
}
