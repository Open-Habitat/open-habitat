import { ControlButton, Segmented } from "./ControlElements";

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
      <div className="s-row">
        <div className="s-lbl">
          <strong>Työtilan editori</strong>
          <span className="s-desc">Puhelimessa aina CodeMirror 6.</span>
        </div>
        <div className="s-val">
          <Segmented
            data-testid="editor-choice"
            label="Työpöydän editori"
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
            Asetusta ei voitu vahvistaa. Lue tallennettu valinta uudelleen ennen
            uutta yritystä.
          </p>
          {onReload && (
            <ControlButton
              data-testid="editor-preference-reload"
              size="row"
              onPress={onReload}
              isDisabled={disabled}
            >
              Lue tallennettu valinta
            </ControlButton>
          )}
        </div>
      )}
    </div>
  );
}
