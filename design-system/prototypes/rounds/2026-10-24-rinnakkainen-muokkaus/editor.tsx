import { type ReactNode, useRef } from "react";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { EditorFileTree } from "../../../../web/src/components/EditorFileTree";
import type { TreeDirectories } from "../../../../web/src/components/editorTree";
import "../../../../web/src/components/BrowserEditor.css";
import CodeMirror, { type LineMark } from "./cm";

// Production BrowserEditor's frame (toolbar, file tree, document) with the
// conflict area opened up as slots. Direction 0 uses the production component
// itself; directions 1–3 differ only in what they put in these slots and in
// what the Save button says and does.
export function ProtoEditor(p: {
  path: string;
  content: string;
  revision: number;
  directories: TreeDirectories;
  picker: boolean;
  onPicker: () => void;
  status: ReactNode;
  saveLabel: string;
  saveDisabled: boolean;
  saveVariant?: "primary" | "secondary" | "danger";
  onSave: () => void;
  onChange: (content: string) => void;
  busy: boolean;
  marks?: LineMark[];
  patch?: { id: number; text: string };
  /** Between the toolbar and the document. */
  banner?: ReactNode;
  /** Replaces the document while open, e.g. a comparison. */
  takeover?: ReactNode;
}) {
  const pickerButton = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="ah-browser-editor"
      data-testid="browser-editor"
      aria-busy={p.busy}
    >
      <div className="ah-browser-toolbar">
        <ControlButton
          ref={pickerButton}
          data-testid="editor-picker"
          size="row"
          onPress={p.onPicker}
          aria-expanded={p.picker}
        >
          Tiedostot
        </ControlButton>
        <code className="ah-browser-filename">{p.path}</code>
        <span role="status" data-testid="editor-dirty">
          {p.status}
        </span>
        <ControlButton
          data-testid="editor-save"
          size="row"
          variant={p.saveVariant ?? "secondary"}
          onPress={p.onSave}
          isDisabled={p.saveDisabled}
        >
          {p.saveLabel}
        </ControlButton>
      </div>
      {p.banner}
      <div className="ah-browser-body">
        <EditorFileTree
          visible={p.picker}
          directories={p.directories}
          openPath={p.path}
          dirty={false}
          onLoad={() => {}}
          onOpen={() => {}}
          onClose={() => {
            p.onPicker();
            pickerButton.current?.focus();
          }}
        />
        <div className="ah-browser-document">
          {p.takeover ?? (
            <CodeMirror
              key={p.revision}
              path={p.path}
              content={p.content}
              onChange={p.onChange}
              onSave={p.onSave}
              disabled={p.busy}
              marks={p.marks}
              patch={p.patch}
            />
          )}
        </div>
      </div>
    </div>
  );
}
