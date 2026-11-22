import { createContext, useContext, useEffect, useRef, useState } from "react";
import { FileLinkContext } from "../components/fileRefs";
import { TurnChanges, TurnChangesUnread } from "../components/TurnChanges";
import { useExperimentalFeature } from "./accountPreferences";
import { fullTextBlock, type HistoryEntry } from "./history";
import {
  readTurnChanges,
  readTurnDiff,
  type TurnSnapshotChanges,
} from "./rewind";
import {
  type FileChange,
  type ToolStep,
  turnChanges,
  withSnapshot,
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
  /** The revisions to read at: the entry's own, then the conversation's. */
  revisions: string[];
  readable: boolean;
  at?: number;
  result?: HistoryEntry;
};

export const savedAt = (entry?: HistoryEntry) => {
  const at = entry?.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
  return Number.isFinite(at) ? at : undefined;
};

// Arguments are not in a history page: each is read from native history by
// its block. A saved entry does not change, so a read is kept across
// revisions; the cache holds the latest reads only.
//
// A block read names the whole native file's revision, which every append
// replaces. An entry the stream delivered carries the revision it was saved
// at, and a turn far up the view is read only once the person scrolls to it,
// often after later turns have been saved: that revision is gone by then, so
// the read falls back to the conversation's newest one.
const cache = new Map<string, Promise<string>>();
async function readAt(
  agentId: string,
  revisions: string[],
  entryKey: string,
  index: number,
): Promise<string> {
  let failure: unknown = new Error("no revision");
  for (const revision of revisions) {
    try {
      return await fullTextBlock(
        agentId,
        revision,
        entryKey,
        index,
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}
export function blockText(
  agentId: string,
  revisions: string[],
  entryKey: string,
  index: number,
): Promise<string> {
  const key = `${agentId}\n${entryKey}\n${index}`;
  let text = cache.get(key);
  if (!text) {
    text = readAt(agentId, revisions, entryKey, index);
    text.catch(() => cache.delete(key));
    cache.set(key, text);
    if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  }
  return text;
}

export const resultText = (result?: HistoryEntry) =>
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
      c.readable && c.revisions.length
        ? blockText(agentId, c.revisions, c.entryKey, c.index)
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
      const revisions = revisionsOf(c.result.native_revision, c.revisions);
      return index >= 0 && revisions.length
        ? blockText(agentId, revisions, c.result.entry_key, index)
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

export const revisionsOf = (own: string | undefined, rest: string[]) =>
  [...new Set([own, ...rest])].filter((r): r is string => !!r);

/** The element the conversation scrolls in, or none for the page. */
function scroller(place: Element): Element | null {
  for (let at = place.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if (overflowY === "auto" || overflowY === "scroll") return at;
  }
  return null;
}

/** Starts the reads once the turn comes near the view.
 *
 * The margin is measured from the conversation's own scroll area: against
 * the page, the area clips the place first and a margin never applies, so a
 * turn was read only when its last pixel was scrolled into sight, and a turn
 * a jump or a restored position passed over showed nothing. */
export function useNear() {
  const [place, setPlace] = useState<HTMLSpanElement | null>(null);
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (near || !place) return;
    const observer = new IntersectionObserver(
      (seen) => {
        if (seen.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: scroller(place), rootMargin: "800px 0px" },
    );
    observer.observe(place);
    return () => observer.disconnect();
  }, [near, place]);
  return [near, setPlace] as const;
}

/** The turn's snapshot comparison, or none when it has no snapshots or the
 * read failed: the tool calls then answer alone, as before snapshots. */
async function readSnapshot(
  agentId: string,
  entry: string,
): Promise<TurnSnapshotChanges | undefined> {
  try {
    const value = await readTurnChanges(agentId, entry);
    return value.snapshot ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Muutokset for one finished turn. Its source is the turn's own tool calls in native
 * history, read through the history block reads the conversation already
 * uses; nothing is stored. With Palaa tähän on, the run's turn snapshots
 * (read by the daemon from the recorder's store) decide which files changed,
 * so a script's or a formatter's changes are listed too.
 */
export function TurnChangesSource({
  entries,
  results,
  agentId,
  revision,
  startedAt,
  userKey,
}: {
  entries: HistoryEntry[];
  results: Map<string, HistoryEntry>;
  agentId?: string;
  revision?: string;
  startedAt?: number;
  /** The person's message the turn answers: the key its snapshots carry. */
  userKey?: string;
}) {
  const root = useContext(TurnChangesRoot);
  const links = useContext(FileLinkContext);
  const snapshots = useExperimentalFeature("rewind-conversation");
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
          revisions: revisionsOf(entry.native_revision, [revision ?? ""]),
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
  // The reads depend only on which calls and results there are, and on
  // whether snapshots are asked for, until the turn's last entry.
  const asked =
    snapshots &&
    !!userKey &&
    entries.some((e) => e.blocks?.some((b) => b.type === "toolCall"));
  const key = calls
    .map(
      (c) =>
        `${c.callId}:${c.result?.entry_key ?? ""}:${c.result?.is_error ?? ""}`,
    )
    .join(",")
    .concat(asked ? `|${userKey}:${entries.at(-1)?.entry_key ?? ""}` : "");
  const [near, ref] = useNear();
  const [read, setRead] = useState<{
    key: string;
    files?: FileChange[];
    unrecorded?: string[];
    unrecordedMore?: number;
  }>();
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ calls, root, asked, userKey });
  latest.current = { calls, root, asked, userKey };
  // A read that failed is tried again with the next revision or on request;
  // one that succeeded is not repeated.
  const retry = read?.key === key && read.files ? "" : `${revision}/${attempt}`;
  useEffect(() => {
    if (!near || !agentId || !key || retry === "") return;
    let current = true;
    const { calls, root, asked, userKey } = latest.current;
    Promise.all([
      readSteps(agentId, calls, root),
      asked && userKey ? readSnapshot(agentId, userKey) : undefined,
    ])
      .then(([steps, snapshot]) => {
        if (!current) return;
        const files = turnChanges(steps, root);
        if (!snapshot || !userKey) return setRead({ key, files });
        setRead({
          key,
          files: withSnapshot(files, snapshot.files, (path) =>
            readTurnDiff(agentId, userKey, path),
          ),
          unrecorded: snapshot.skipped,
          unrecordedMore: snapshot.skipped_more,
        });
      })
      // A turn whose calls cannot be read shows no card rather than a wrong
      // one; an earlier result stays.
      .catch(() => {
        if (current) setRead((was) => (was?.files ? was : { key }));
      });
    return () => {
      current = false;
    };
  }, [near, agentId, key, retry]);
  if (!key) return null;
  // A newer revision is read in place; the earlier result stays meanwhile.
  if (!read)
    return <span ref={ref} className="ah-tc-sentinel" aria-hidden="true" />;
  if (!read.files)
    // Only a turn that edited or wrote a file says it could not be read: a
    // turn of reads and commands most likely changed nothing.
    return calls.some((c) => c.tool === "edit" || c.tool === "write") ? (
      <TurnChangesUnread onRetry={() => setAttempt((n) => n + 1)} />
    ) : null;
  return (
    <TurnChanges
      files={read.files}
      start={startedAt}
      end={end}
      interims={interims}
      onOpen={
        links ? (path, line) => links.open({ path, line }, path) : undefined
      }
      unrecorded={read.unrecorded}
      unrecordedMore={read.unrecordedMore}
    />
  );
}
