import { useState } from "react";
import { ArchiveNotice } from "../components/ArchiveNotice";
import { liveText } from "../i18n";
import { editorSaveNoticeText } from "../text/editorSaveNotice";
import type { LeaveSave } from "./BrowserDocument";
import { readEditorFile, saveEditorFile } from "./editorFiles";

const txt = liveText(editorSaveNoticeText);

/** After leaving the editor saved its text: Kumoa writes back the version
 * that was on disk before, on the version the save wrote, so the daemon
 * refuses it if anyone changed the file since (Jari 7.11.2026: Kumoa is a
 * real undo, not a return to unsaved text). */
export function EditorSaveNotice({
  save,
  csrf,
  onClose,
}: {
  save: LeaveSave;
  csrf: string;
  onClose: () => void;
}) {
  const { before, after } = save;
  const name = after.path.split("/").pop() ?? after.path;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [undone, setUndone] = useState(false);
  const undo = async () => {
    setBusy(true);
    setProblem("");
    const result = await saveEditorFile(
      { ...before, version: after.version },
      before.content,
      csrf,
    );
    let restored = result.kind === "ok";
    if (result.kind === "uncertain") {
      // An uncertain write is settled by reading the file, never by resending.
      try {
        const now = await readEditorFile(after.workspace_id, after.path);
        restored = now.content === before.content;
        if (!restored) setProblem(txt.undoUnknown);
      } catch {
        setProblem(txt.undoUnknown);
      }
    } else if (result.kind === "refused" && result.code === "file_changed")
      setProblem(txt.changedSince);
    else if (!restored) setProblem(txt.undoFailed);
    setUndone(restored);
    setBusy(false);
  };
  return (
    <ArchiveNotice
      kind="editor-save"
      message={undone ? txt.undone(name) : txt.saved}
      title={undone ? undefined : name}
      restoreLabel={txt.undo}
      busy={busy}
      problem={problem || undefined}
      onRestore={undone || problem ? undefined : () => void undo()}
      onClose={onClose}
    />
  );
}
