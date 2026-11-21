import { useCallback, useEffect, useRef, useState } from "react";
import type { InstructionsSaveResult } from "../components/InstructionsEditor";
import { liveText } from "../i18n";
import { agentInstructionsText } from "../text/agentInstructions";
import {
  type AgentInstructions,
  InstructionsError,
  readAgentInstructions,
  saveAgentInstructions,
} from "./agentInstructions";

const txt = liveText(agentInstructionsText);

export type InstructionsState =
  | { phase: "loading" }
  | { phase: "error"; code: string }
  | { phase: "ready"; file: AgentInstructions };

/** The person's instructions file as the daemon last read it, and a save
 * that is compare-and-swap against the version this page started from. A
 * refused save reads the file again and hands its text to the editor to
 * merge; an uncertain one reads it again and counts as saved only when the
 * file holds exactly the text. Nothing is ever sent twice by itself. */
export function useAgentInstructions(csrf: string | undefined) {
  const [state, setState] = useState<InstructionsState>({ phase: "loading" });
  const [reload, setReload] = useState(0);
  // The version the next save names: the read the editor's text is based on.
  const base = useRef<string | null>(null);
  useEffect(() => {
    void csrf;
    void reload;
    const controller = new AbortController();
    setState({ phase: "loading" });
    readAgentInstructions(controller.signal)
      .then((file) => {
        if (controller.signal.aborted) return;
        base.current = file.version;
        setState({ phase: "ready", file });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          phase: "error",
          code: e instanceof InstructionsError ? e.code : "unavailable",
        });
      });
    return () => controller.abort();
  }, [csrf, reload]);

  const save = useCallback(
    async (text: string): Promise<InstructionsSaveResult> => {
      if (!csrf) return { error: txt.saveLogin };
      const outcome = await saveAgentInstructions(csrf, text, base.current);
      if (outcome.kind === "saved") {
        base.current = outcome.file.version;
        setState({ phase: "ready", file: outcome.file });
        return { ok: true };
      }
      if (outcome.kind === "login") return { error: txt.saveLogin };
      if (outcome.kind === "refused")
        return {
          error:
            outcome.code === "file_unsupported"
              ? txt.unsupported
              : outcome.code === "file_too_large"
                ? txt.tooLarge
                : txt.saveRefused,
        };
      let fresh: AgentInstructions;
      try {
        fresh = await readAgentInstructions();
      } catch {
        return {
          error:
            outcome.kind === "changed" ? txt.saveRefused : txt.saveUncertain,
        };
      }
      if (outcome.kind === "uncertain") {
        if (!fresh.exists || fresh.content !== text)
          return { error: txt.saveUncertain };
        base.current = fresh.version;
        setState({ phase: "ready", file: fresh });
        return { ok: true };
      }
      // Changed meanwhile: the next save is based on what is there now.
      base.current = fresh.version;
      return { conflict: fresh.content };
    },
    [csrf],
  );
  return { state, save, retry: () => setReload((n) => n + 1) };
}
