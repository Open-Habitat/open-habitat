import { useText } from "../i18n";
import { editorReplaceNoteText } from "../text/editorReplaceNote";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./EditorReplaceNote.css";

/** At the end of the conversation whose agent's changes a save in the
 * browser editor replaced. Only this tab shows it; the agent does not see it
 * unless the person tells it. Telling and closing both end the note. */
export function EditorReplaceNote({
  path,
  at,
  changes,
  tellBlocked,
  onTell,
  onDismiss,
}: {
  path: string;
  at: string;
  changes: { line: number; theirs: string[] }[];
  /** Why the conversation cannot take a message now. */
  tellBlocked?: string;
  onTell: () => void;
  onDismiss: () => void;
}) {
  const t = useText(editorReplaceNoteText);
  return (
    <aside className="ah-replace-note" data-testid="replace-note">
      <p className="ah-replace-note-head">
        <Icon name="info" />
        <strong>{t.title}</strong>
        <small>{at}</small>
        <ControlButton
          data-testid="replace-note-dismiss"
          variant="quiet"
          size="inline"
          aria-label={t.dismiss}
          onPress={onDismiss}
        >
          <Icon name="cross" />
        </ControlButton>
      </p>
      <p>{t.savedOwn(<code>{path}</code>, changes.length)}</p>
      <ul>
        {changes.map((change) => (
          <li key={change.line} data-testid="replace-note-line">
            {t.line(change.line)}{" "}
            <code>
              {change.theirs.filter(Boolean).join(" / ") || t.deletion}
            </code>
          </li>
        ))}
      </ul>
      <div className="ah-replace-note-foot">
        <small>{t.onlyYou}</small>
        <ControlButton
          data-testid="tell-agent"
          size="row"
          isDisabled={!!tellBlocked}
          title={tellBlocked}
          onPress={onTell}
        >
          <Icon name="message" />
          {t.tellAgent}
        </ControlButton>
      </div>
    </aside>
  );
}
