import { useCallback, useEffect, useRef, useState } from "react";
import { liveText } from "../i18n";
import { workspaceIconWriteText } from "../text/workspaceIconWrite";
import { refusalReason, writeOutcome, writerHolder } from "./mutations";
import type { Workspace } from "./snapshot";
import type { HostChange } from "./store";
import { iconSetting } from "./workspaceIcons";
import { readWorkspaceResult, sendWorkspace } from "./workspaceWrites";

// The workspace page's icon write (workspace-icons, experimental; Otsikko,
// Jari 2026-10-30): a choice is written to the repository's
// .open-habitat.yaml and committed at once, without asking. The page shows
// the choice while the host works; the confirmed choice goes into the host
// model at once, so the rail shows it too without waiting for a snapshot
// (Jari 11.11.2026: the rail's icon came "really slowly"). The page then
// says what was written and committed, with an undo when there was an
// icon line to go back to (Jari 2026-10-31: a silent commit left him
// wondering whether anything was saved). A refusal is told in the page.

type Choice = { value: string; id: number };

/** What a confirmed write did, for the page's notice. */
export type IconWritten = {
  value: string;
  commit: string;
  /** The config's icon before, which Kumoa writes back. */
  previous?: string;
  /** This write was itself an undo: nothing more to undo. */
  undo: boolean;
};

const txt = liveText(workspaceIconWriteText);
/** Why a confirmed icon write did not end in a commit, if it did not. */
export const commitNote = (code: string): string | undefined =>
  Object.hasOwn(txt.commitNotes, code) ? txt.commitNotes[code] : undefined;

export function useWorkspaceIconWrite({
  workspace,
  csrf,
  refresh,
  reread,
  onChanged,
  onLogin,
}: {
  workspace: Workspace;
  csrf?: string;
  refresh: () => void;
  /** Reads the page's Git status again: the commit changed it. */
  reread: () => void;
  /** Applies a confirmed choice to the host model. */
  onChanged?: (change: HostChange) => void;
  onLogin?: () => void;
}) {
  const [choice, setChoice] = useState<Choice>();
  const [note, setNote] = useState("");
  const [written, setWritten] = useState<IconWritten>();
  const dismissWritten = useCallback(() => setWritten(undefined), []);
  const serial = useRef(0);
  const setting = iconSetting(workspace);
  // The snapshot carries the choice: the page no longer needs to hold it.
  useEffect(() => {
    if (choice && setting === choice.value) setChoice(undefined);
  }, [choice, setting]);
  const token = workspace.observation_token;
  const available = !!csrf && !!token && workspace.mutation_state === "allowed";
  const choose = async (value: string, undo = false) => {
    if (!available || !csrf || !token) return;
    const id = ++serial.current;
    const previous = setting;
    setChoice({ value, id });
    setNote("");
    setWritten(undefined);
    const commandId = crypto.randomUUID();
    let outcome: Awaited<ReturnType<typeof writeOutcome>>;
    try {
      outcome = await writeOutcome(
        await sendWorkspace(
          "workspace.icon",
          {
            action: "icon",
            workspace_id: workspace.workspace_id,
            observation_token: token,
            icon: value,
          },
          csrf,
          commandId,
        ),
      );
    } catch {
      outcome = { kind: "uncertain" };
    }
    if (id !== serial.current) return;
    if (outcome.kind === "ok") {
      try {
        const result = await readWorkspaceResult(outcome.response, commandId);
        onChanged?.({
          kind: "icon",
          workspace_id: workspace.workspace_id,
          icon: value,
          cursor: result.event_cursor,
        });
        setWritten({
          value,
          commit: result.icon_commit ?? "",
          previous: previous === value ? undefined : previous,
          undo,
        });
      } catch {
        setNote(txt.uncertain);
      }
    } else if (outcome.kind === "refused") {
      setChoice(undefined);
      setNote(
        Object.hasOwn(txt.refusals, outcome.code)
          ? txt.refusals[outcome.code]
          : writerHolder(outcome.code)
            ? `${txt.refused} ${refusalReason(outcome.code)}`
            : txt.refused,
      );
    } else if (outcome.kind === "login") {
      setChoice(undefined);
      onLogin?.();
    } else {
      setChoice(undefined);
      setNote(txt.uncertain);
    }
    refresh();
    reread();
  };
  return {
    pending: choice?.value,
    note,
    written,
    dismissWritten,
    available,
    choose,
  };
}
