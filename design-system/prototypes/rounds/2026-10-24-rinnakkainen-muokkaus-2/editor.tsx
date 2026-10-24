import { type MutableRefObject, type ReactNode, useRef } from "react";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { EditorFileTree } from "../../../../web/src/components/EditorFileTree";
import type { TreeDirectories } from "../../../../web/src/components/editorTree";
import "../../../../web/src/components/BrowserEditor.css";
import CodeMirror, { type ConflictRenderer, type EditorApi, type MergeState } from "./cm";

// Production BrowserEditor's frame (toolbar, file tree, document) with the
// conflict area opened up as a slot. The directions differ only in what they
// put in the status and banner slots; the merge itself is the same in each.
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
  onChange: (content: string, merge: MergeState, typed: boolean) => void;
  busy: boolean;
  api: MutableRefObject<EditorApi | undefined>;
  renderConflict: ConflictRenderer;
  /** Why Save is unavailable, said beside it rather than left to guess. */
  saveReason?: string;
  /** Between the toolbar and the document. */
  banner?: ReactNode;
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
          aria-describedby={p.saveReason ? "cfe-save-reason" : undefined}
        >
          {p.saveLabel}
        </ControlButton>
      </div>
      {p.saveReason && (
        <p className="cfe-save-reason" id="cfe-save-reason" data-testid="save-reason">
          {p.saveReason}
        </p>
      )}
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
          <CodeMirror
            key={p.revision}
            path={p.path}
            content={p.content}
            onChange={p.onChange}
            onSave={p.onSave}
            disabled={p.busy}
            api={p.api}
            renderConflict={p.renderConflict}
          />
        </div>
      </div>
    </div>
  );
}
