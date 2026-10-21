import { useEffect, useRef, useState } from "react";
import {
  type CatalogueSkill,
  skillDraft,
  StartHere,
} from "../components/StartHere";
import { type CommandList, readCommands } from "./composerReads";

// Only the explicitly acknowledged cutoff is persisted. No skill inventory,
// history or per-card activity is stored. It is local to this browser/device.
export function SkillDiscovery({
  identity,
  workspaceId,
  agentId,
  draft,
  onChange,
}: {
  identity: string;
  workspaceId: string;
  agentId?: string;
  draft: string;
  onChange: (draft: string) => void;
}) {
  const [list, setList] = useState<CommandList>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const [cutoff, setCutoff] = useState<number>();
  const opening = useRef(Date.now());
  const root = useRef<HTMLDivElement>(null);
  const key = `oh-skill-cutoff:${JSON.stringify([identity, list?.repository_key ?? workspaceId])}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries the native read.
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    readCommands(agentId ? { agentId } : { workspaceId }, controller.signal)
      .then((v) => {
        if (controller.signal.aborted) return;
        setList(v);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [workspaceId, agentId, attempt]);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      setCutoff(
        Number.isFinite(stored) && stored > 0 && stored <= Date.now()
          ? stored
          : undefined,
      );
    } catch {
      setCutoff(undefined);
    }
  }, [key]);
  const [storageProblem, setStorageProblem] = useState(false);
  return (
    <div ref={root}>
      <StartHere
        skills={(state === "ready" ? (list?.commands ?? []) : []).filter(
          (s): s is CatalogueSkill => s.source === "skill",
        )}
        state={state}
        cutoff={cutoff}
        onRetry={() => retry((v) => v + 1)}
        onOpen={() => {
          opening.current = Date.now();
          retry((v) => v + 1);
        }}
        onAcknowledge={() => {
          try {
            localStorage.setItem(key, String(opening.current));
            setCutoff(opening.current);
            setStorageProblem(false);
          } catch {
            setStorageProblem(true);
          }
        }}
        onTry={(skill) => {
          onChange(skillDraft(skill, draft));
          requestAnimationFrame(() =>
            root.current
              ?.closest(".ah-conversation-frame")
              ?.querySelector("textarea")
              ?.focus(),
          );
        }}
      />
      {storageProblem ? (
        <p role="status">
          Katselumerkintää ei voitu tallentaa tähän selaimeen.
        </p>
      ) : null}
    </div>
  );
}
