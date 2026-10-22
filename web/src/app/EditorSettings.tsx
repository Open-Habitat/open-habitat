import { useEffect, useState } from "react";
import {
  chooseEditor,
  loadEditorPreference,
  useEditorChoice,
} from "./editorPreference";

export function EditorSettings({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const state = useEditorChoice(identity, csrf);
  const choice = state.engine;
  const [compact, setCompact] = useState(() => window.innerWidth <= 800);
  useEffect(() => {
    const resize = () => setCompact(window.innerWidth <= 800);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return (
    <div className="s-card" data-testid="editor-settings">
      <fieldset disabled={!identity || !csrf || state.busy}>
        <legend>Työtilan editori</legend>
        <p>
          Valinta tallennetaan omaan asetustiedostoosi palvelimella ja seuraa
          sinua laitteelta toiselle. Tiedostojen sisältöä ei tallenneta
          selaimeen.
        </p>
        {(["codemirror6", "vscode"] as const).map((engine) => (
          <p key={engine}>
            <label>
              <input
                type="radio"
                name="workspace-editor-engine"
                data-testid={`editor-choice-${engine}`}
                checked={(compact ? "codemirror6" : choice) === engine}
                disabled={compact && engine !== "codemirror6"}
                onChange={() => {
                  if (identity && csrf)
                    void chooseEditor(identity, engine, csrf);
                }}
              />
              {engine === "codemirror6" ? "CodeMirror 6" : "VS Code"}
            </label>
            {compact && engine !== "codemirror6" && (
              <span> — puhelimessa käytetään CodeMirroria</span>
            )}
          </p>
        ))}
        <p>
          CodeMirror muokkaa yhtä tekstitiedostoa kerrallaan. VS Code tarjoaa
          koko työpöytäeditorin ja käynnistyy vain avattaessa.
        </p>
        {compact && choice !== "codemirror6" && (
          <p>Työpöydän valinta säilyy ennallaan.</p>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" data-testid="editor-preference-error">
          Asetusta ei voitu vahvistaa. Lue tallennettu valinta uudelleen ennen
          uutta yritystä.
        </p>
      )}
      {state.error && identity && csrf && (
        <button
          type="button"
          data-testid="editor-preference-reload"
          onClick={() => void loadEditorPreference(identity, csrf)}
        >
          Lue tallennettu valinta
        </button>
      )}
    </div>
  );
}
