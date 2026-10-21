import { useEffect, useState } from "react";
import { chooseEditor, useEditorPreference } from "./editorPreference";

export function EditorSettings({ identity }: { identity?: string }) {
  const choice = useEditorPreference(identity);
  const [compact, setCompact] = useState(() => window.innerWidth <= 800);
  useEffect(() => {
    const resize = () => setCompact(window.innerWidth <= 800);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return (
    <div className="s-card" data-testid="editor-settings">
      <fieldset disabled={!identity}>
        <legend>Työtilan editori</legend>
        <p>
          Valinta koskee tätä selainta ja tiliä. Tiedostojen sisältöä ei
          tallenneta selaimeen.
        </p>
        {(["codemirror6", "monaco", "vscode"] as const).map((engine) => (
          <p key={engine}>
            <label>
              <input
                type="radio"
                name="workspace-editor-engine"
                data-testid={`editor-choice-${engine}`}
                checked={(compact ? "codemirror6" : choice) === engine}
                disabled={
                  engine === "monaco" || (compact && engine !== "codemirror6")
                }
                onChange={() => {
                  if (identity) chooseEditor(identity, engine);
                }}
              />
              {engine === "codemirror6"
                ? "CodeMirror 6"
                : engine === "monaco"
                  ? "Monaco — ei vielä käytettävissä"
                  : "VS Code"}
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
    </div>
  );
}
