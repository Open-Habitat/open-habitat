import { useCallback, useEffect, useRef, useState } from "react";
import { writeOutcome } from "./mutations";
import type { Workspace } from "./snapshot";
import { iconSetting } from "./workspaceIcons";
import { readWorkspaceResult, sendWorkspace } from "./workspaceWrites";

// The workspace page's icon write (workspace-icons, experimental; Otsikko,
// Jari 2026-10-30): a choice is written to the repository's
// .open-habitat.yaml and committed at once, without asking. The page shows
// the choice while the host works and until the next snapshot carries it,
// then says what was written and committed, with an undo when there was an
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

const refusals: Record<string, string> = {
  icon_invalid: "Kuvaketta ei tallennettu: arvo ei kelpaa kuvakkeeksi.",
  icon_config_unsupported:
    "Kuvaketta ei tallennettu: .open-habitat.yaml on muodossa, jota sivu ei osaa muokata rivi riviltä. Muokkaa icon-riviä itse.",
  workspace_busy:
    "Kuvaketta ei tallennettu: työtilassa on juuri toinen muutos kesken. Yritä hetken päästä uudelleen.",
  workspace_changed:
    "Kuvaketta ei tallennettu: työtila muuttui. Päivitä sivu ja yritä uudelleen.",
};
export const commitNotes: Record<string, string> = {
  uncommitted:
    "Kuvake tallentui .open-habitat.yaml-tiedostoon, mutta sitä ei commitoitu, koska tiedostossa oli jo omia muutoksia.",
  commit_failed:
    "Kuvake tallentui .open-habitat.yaml-tiedostoon, mutta Git ei ottanut committia vastaan. Tiedosto odottaa commitia.",
};

export function useWorkspaceIconWrite({
  workspace,
  csrf,
  refresh,
  reread,
  onLogin,
}: {
  workspace: Workspace;
  csrf?: string;
  refresh: () => void;
  /** Reads the page's Git status again: the commit changed it. */
  reread: () => void;
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
        setWritten({
          value,
          commit: result.icon_commit ?? "",
          previous: previous === value ? undefined : previous,
          undo,
        });
      } catch {
        setNote(
          "Kuvakkeen tallennusta ei voitu vahvistaa. Sivu lukee tilan uudelleen.",
        );
      }
    } else if (outcome.kind === "refused") {
      setChoice(undefined);
      setNote(refusals[outcome.code] ?? "Kuvaketta ei tallennettu.");
    } else if (outcome.kind === "login") {
      setChoice(undefined);
      onLogin?.();
    } else {
      setChoice(undefined);
      setNote(
        "Kuvakkeen tallennusta ei voitu vahvistaa. Sivu lukee tilan uudelleen.",
      );
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
