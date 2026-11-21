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
  mine,
  source,
  onPick,
}: {
  theirs: string[];
  /** The person's lines, for an editor that cannot mark them in its text
   * (the instructions editor's plain text field): the card shows both. */
  mine?: string[];
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
        <span>{mine ? t.chooseOne : t.yoursBelow}</span>
      </p>
      {mine ? (
        <pre className="ah-merge-theirs" data-testid="conflict-mine">
          <small>{t.yours}</small>
          {mine.join("\n") || t.lineDeleted}
        </pre>
      ) : null}
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
