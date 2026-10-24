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
  return (
    <aside className="ah-replace-note" data-testid="replace-note">
      <p className="ah-replace-note-head">
        <Icon name="info" />
        <strong>Korvasit agentin muutoksia</strong>
        <small>{at}</small>
        <ControlButton
          data-testid="replace-note-dismiss"
          variant="quiet"
          size="inline"
          aria-label="Sulje merkintä"
          onPress={onDismiss}
        >
          <Icon name="cross" />
        </ControlButton>
      </p>
      <p>
        Tallensit tiedoston <code>{path}</code> omalla tekstilläsi.{" "}
        {changes.length === 1
          ? "Tämä agentin muutos ei ole enää tiedostossa:"
          : "Nämä agentin muutokset eivät ole enää tiedostossa:"}
      </p>
      <ul>
        {changes.map((change) => (
          <li key={change.line} data-testid="replace-note-line">
            rivi {change.line}:{" "}
            <code>
              {change.theirs.filter(Boolean).join(" / ") || "(poisto)"}
            </code>
          </li>
        ))}
      </ul>
      <div className="ah-replace-note-foot">
        <small>
          Vain sinä näet tämän. Agentti ei tiedä korvauksesta, ellet kerro.
        </small>
        <ControlButton
          data-testid="tell-agent"
          size="row"
          isDisabled={!!tellBlocked}
          title={tellBlocked}
          onPress={onTell}
        >
          <Icon name="message" />
          Kerro agentille
        </ControlButton>
      </div>
    </aside>
  );
}
