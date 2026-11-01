import { liveText } from "../i18n";
import { editorSettingsText } from "../text/editorSettings";
import { ControlButton, Segmented } from "./ControlElements";

const txt = liveText(editorSettingsText);

export function EditorSettingsControl({
  choice,
  disabled,
  error,
  onChange,
  onReload,
}: {
  choice: "codemirror6" | "vscode";
  disabled: boolean;
  error: boolean;
  onChange: (choice: "codemirror6" | "vscode") => void;
  onReload?: () => void;
}) {
  return (
    <div className="s-card" data-testid="editor-settings">
      <div className="s-row" data-settings-row="editor" tabIndex={-1}>
        <div className="s-lbl">
          <strong>{txt.label}</strong>
          <span className="s-desc">{txt.phone}</span>
        </div>
        <div className="s-val">
          <Segmented
            size="row"
            data-testid="editor-choice"
            label={txt.desktop}
            options={[
              { id: "codemirror6", label: "CodeMirror 6" },
              { id: "vscode", label: "VS Code" },
            ]}
            value={choice}
            isDisabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
      {error && (
        <div className="s-row">
          <p role="alert" data-testid="editor-preference-error">
            {txt.error}
          </p>
          {onReload && (
            <ControlButton
              data-testid="editor-preference-reload"
              size="row"
              onPress={onReload}
              isDisabled={disabled}
            >
              {txt.reload}
            </ControlButton>
          )}
        </div>
      )}
    </div>
  );
}
