import { createContext, useContext, useEffect, useRef, useState } from "react";
import { FileLinkContext } from "../components/fileRefs";
import { TurnChanges } from "../components/TurnChanges";
import { useExperimentalFeature } from "./accountPreferences";
import { fullTextBlock, type HistoryEntry } from "./history";
import {
  type FileChange,
  type ToolStep,
  turnChanges,
  workspacePath,
} from "./turnChanges";

/** The workspace directory a conversation's relative tool paths resolve in. */
export const TurnChangesRoot = createContext<string | undefined>(undefined);

const tools = new Set(["edit", "write", "read", "bash"]);

type Call = {
  callId: string;
  tool: string;
  entryKey: string;
  index: number;
  revision?: string;
  readable: boolean;
  at?: number;
  result?: HistoryEntry;
};

const savedAt = (entry?: HistoryEntry) => {
  const at = entry?.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
  return Number.isFinite(at) ? at : undefined;
};

// Arguments are not in a history page: each is read from native history by
// its block. A saved entry does not change, so a read is kept across
// revisions; the cache holds the latest reads only.
const cache = new Map<string, Promise<string>>();
function blockText(
  agentId: string,
  revision: string,
  entryKey: string,
  index: number,
): Promise<string> {
  const key = `${agentId}\n${entryKey}\n${index}`;
  let text = cache.get(key);
  if (!text) {
    text = fullTextBlock(
      agentId,
      revision,
      entryKey,
      index,
      new AbortController().signal,
    );
    text.catch(() => cache.delete(key));
    cache.set(key, text);
    if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  }
  return text;
}

const resultText = (result?: HistoryEntry) =>
  result?.blocks
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n") ?? result?.content.text;

/** The turn's tool calls with their arguments read, and the whole output of
 * each read whose file the turn later changes. */
async function readSteps(
  agentId: string,
  calls: Call[],
  root: string | undefined,
): Promise<ToolStep[]> {
  const args = await Promise.all(
    calls.map((c) =>
      c.readable && c.revision
        ? blockText(agentId, c.revision, c.entryKey, c.index)
        : Promise.resolve(""),
    ),
  );
  const pathOf = (raw: string) => {
    try {
      const v = JSON.parse(raw) as { path?: unknown };
      return typeof v.path === "string"
        ? workspacePath(v.path, root)?.path
        : undefined;
    } catch {
      return undefined;
    }
  };
  const outputs = await Promise.all(
    calls.map(async (c, i) => {
      if (c.tool !== "read" || !c.result || c.result.is_error) return undefined;
      const path = pathOf(args[i]);
      const changed = calls.some(
        (later, j) =>
          j > i &&
          (later.tool === "edit" || later.tool === "write") &&
          pathOf(args[j]) === path,
      );
      if (!path || !changed) return undefined;
      const index =
        c.result.blocks?.findIndex((b) => b.type === "text" && b.readable) ??
        -1;
      const revision = c.result.native_revision ?? c.revision;
      return index >= 0 && revision
        ? blockText(agentId, revision, c.result.entry_key, index)
        : resultText(c.result);
    }),
  );
  return calls.map((c, i) => ({
    callId: c.callId,
    tool: c.tool,
    args: args[i],
    output: outputs[i],
    // A call without a saved result did not finish: it is not counted.
    failed: !c.result || !!c.result.is_error,
    at: c.at,
  }));
}

/** Starts the reads once the turn comes near the view. */
function useNear() {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (near || !ref.current) return;
    const observer = new IntersectionObserver(
      (seen) => {
        if (seen.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);
  return [near, ref] as const;
}

/**
 * Muutokset for one finished turn, when the person has turned the
 * experimental feature on. Its source is the turn's own tool calls in native
 * history, read through the history block reads the conversation already
 * uses; nothing is stored.
 */
export function TurnChangesSource({
  entries,
  results,
  agentId,
  revision,
  startedAt,
}: {
  entries: HistoryEntry[];
  results: Map<string, HistoryEntry>;
  agentId?: string;
  revision?: string;
  startedAt?: number;
}) {
  const on = useExperimentalFeature("turn-changes");
  const root = useContext(TurnChangesRoot);
  const links = useContext(FileLinkContext);
  const calls: Call[] = entries.flatMap((entry) =>
    (entry.blocks ?? []).flatMap((block, index) => {
      if (
        block.type !== "toolCall" ||
        !block.tool_call_id ||
        !tools.has(block.tool_name ?? "")
      )
        return [];
      const result = results.get(block.tool_call_id);
      return [
        {
          callId: block.tool_call_id,
          tool: block.tool_name ?? "",
          entryKey: entry.entry_key,
          index,
          revision: entry.native_revision ?? revision,
          readable: !!block.readable,
          at: savedAt(result) ?? savedAt(entry),
          result,
        },
      ];
    }),
  );
  const texts = entries.filter((e) =>
    e.blocks?.length
      ? e.blocks.some((b) => b.type === "text" && b.text?.trim())
      : !!e.content.text.trim(),
  );
  const interims = texts
    .slice(0, -1)
    .flatMap((e) => (savedAt(e) === undefined ? [] : [savedAt(e) as number]));
  const end = savedAt(entries.at(-1));
  // The reads depend only on which calls and results there are.
  const key = calls
    .map(
      (c) =>
        `${c.callId}:${c.result?.entry_key ?? ""}:${c.result?.is_error ?? ""}`,
    )
    .join(",");
  const [near, ref] = useNear();
  const [read, setRead] = useState<{ key: string; files: FileChange[] }>();
  const latest = useRef({ calls, root });
  latest.current = { calls, root };
  // A read that failed (the file moved on under it) is tried again with the
  // next revision; one that succeeded is not repeated.
  const retry = read?.key === key ? "" : revision;
  useEffect(() => {
    if (!on || !near || !agentId || !key || retry === "") return;
    let current = true;
    const { calls, root } = latest.current;
    readSteps(agentId, calls, root)
      .then((steps) => {
        if (current) setRead({ key, files: turnChanges(steps, root) });
      })
      // A turn whose calls cannot be read shows no card rather than a wrong one.
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [on, near, agentId, key, retry]);
  if (!on || !key) return null;
  // A newer revision is read in place; the earlier result stays meanwhile.
  if (!read)
    return <span ref={ref} className="ah-tc-sentinel" aria-hidden="true" />;
  return (
    <TurnChanges
      files={read.files}
      start={startedAt}
      end={end}
      interims={interims}
      onOpen={
        links ? (path, line) => links.open({ path, line }, path) : undefined
      }
    />
  );
}
