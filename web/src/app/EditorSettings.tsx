import { EditorSettingsControl } from "../components/EditorSettings";
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
  return (
    <EditorSettingsControl
      choice={state.engine}
      disabled={!identity || !csrf || state.busy}
      error={state.error}
      onChange={(engine) => {
        if (identity && csrf) void chooseEditor(identity, engine, csrf);
      }}
      onReload={
        identity && csrf
          ? () => void loadEditorPreference(identity, csrf)
          : undefined
      }
    />
  );
}
