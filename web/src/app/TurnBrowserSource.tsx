import { useContext, useEffect, useRef, useState } from "react";
import { SharedViewer } from "../components/Multiplayer";
import {
  type BrowserCardState,
  BrowserGaveBackLine,
  BrowserTurnCard,
} from "../components/ServerBrowser";
import { useExperimentalFeature } from "./accountPreferences";
import {
  controlSpans,
  noteBrowserUse,
  noteBrowserWindows,
  useBrowserConversations,
} from "./browserConversations";
import type { HistoryEntry } from "./history";
import {
  openBrowserSheet,
  setBrowserControl,
  useServerBrowserState,
} from "./serverBrowser";
import {
  blockText,
  resultText,
  revisionsOf,
  savedAt,
  useNear,
} from "./TurnChangesSource";
import { type BrowserVisits, turnBrowserVisits } from "./turnBrowserVisits";
import type { ToolStep } from "./turnChanges";

type Call = {
  callId: string;
  entryKey: string;
  index: number;
  revisions: string[];
  readable: boolean;
  at?: number;
  result?: HistoryEntry;
};

/** Only a whole CLI envelope can carry a browser fact; anything else is not
 * read further. The history page's preview always holds its start. */
const envelope = (text?: string) =>
  !!text && text.trimStart().startsWith("{") && text.includes('"cli_version"');
/** `agent browser request` answers with the browser's status, as `status`
 * does: only those calls need their command read to tell them apart. */
const statusShaped = (text: string) => text.includes('"skill_command"');

/** The turn's bash calls whose output is a CLI envelope, with the whole
 * output and, where it looks like the browser's status, the command. A
 * participant reads only what the history page already holds: the owner's
 * block reads are never theirs. */
async function readSteps(
  agentId: string | undefined,
  calls: Call[],
): Promise<ToolStep[]> {
  return Promise.all(
    calls.map(async (c): Promise<ToolStep> => {
      const failed = !c.result || !!c.result.is_error;
      const preview = resultText(c.result);
      if (failed || !envelope(preview))
        return { callId: c.callId, tool: "bash", args: "", failed: true };
      let output = preview;
      const block =
        c.result?.blocks?.findIndex((b) => b.type === "text" && b.readable) ??
        -1;
      if (block >= 0 && c.result) {
        const revisions = revisionsOf(c.result.native_revision, c.revisions);
        output =
          agentId && revisions.length
            ? await blockText(agentId, revisions, c.result.entry_key, block)
            : undefined;
      }
      const args =
        agentId &&
        output &&
        statusShaped(output) &&
        c.readable &&
        c.revisions.length
          ? await blockText(agentId, c.revisions, c.entryKey, c.index)
          : "";
      return {
        callId: c.callId,
        tool: "bash",
        args,
        output,
        failed: !output,
        at: c.at,
      };
    }),
  );
}

/**
 * The Selain card for one turn (server-browser-entry-points round 3, 2
 * Kortti). Like Muutokset, its source is the turn's own tool calls in native
 * history; the browser's live state, read by the sheet host, only says
 * whether the request this turn made is still open and who drives. A window
 * the turn's commands named links the browser to this conversation for the
 * rail. Behind the remote-browser experiment.
 */
export function TurnBrowserSource({
  entries,
  results,
  agentId,
  revision,
  working = false,
}: {
  entries: HistoryEntry[];
  results: Map<string, HistoryEntry>;
  agentId?: string;
  revision?: string;
  working?: boolean;
}) {
  const on = useExperimentalFeature("remote-browser");
  const shared = useContext(SharedViewer);
  const owner = !shared && !!agentId;
  const calls: Call[] = entries.flatMap((entry) =>
    (entry.blocks ?? []).flatMap((block, index) => {
      if (
        block.type !== "toolCall" ||
        !block.tool_call_id ||
        block.tool_name !== "bash"
      )
        return [];
      const result = results.get(block.tool_call_id);
      return [
        {
          callId: block.tool_call_id,
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
  const key = calls
    .filter((c) => envelope(resultText(c.result)))
    .map((c) => `${c.callId}:${c.result?.entry_key ?? ""}`)
    .join(",");
  const [near, ref] = useNear();
  const [read, setRead] = useState<{ key: string; visits?: BrowserVisits }>();
  const latest = useRef(calls);
  latest.current = calls;
  useEffect(() => {
    if (!on || !near || !key) return;
    let current = true;
    readSteps(owner ? agentId : undefined, latest.current)
      .then((steps) => {
        if (current)
          setRead({
            key,
            visits: turnBrowserVisits(steps, owner ? "owner" : "participant"),
          });
      })
      // A turn whose calls cannot be read shows no card rather than a
      // wrong one; an earlier result stays.
      .catch(() => {
        if (current) setRead((was) => was ?? { key });
      });
    return () => {
      current = false;
    };
  }, [on, near, key, agentId, owner]);
  const visits = read?.visits;
  useEffect(() => {
    if (!owner || !agentId || !visits) return;
    if (visits.windows?.length) noteBrowserWindows(agentId, visits.windows);
    if (working) noteBrowserUse(agentId);
  }, [owner, agentId, visits, working]);
  if (!on || !key) return null;
  if (!read)
    return <span ref={ref} className="ah-tc-sentinel" aria-hidden="true" />;
  if (!visits) return null;
  return <LiveBrowserCard visits={visits} owner={owner} working={working} />;
}

/** The card with the browser's live state: only a turn that used the
 * browser follows the state's reads, not every turn of the conversation. */
function LiveBrowserCard({
  visits,
  owner,
  working,
}: {
  visits: BrowserVisits;
  owner: boolean;
  working: boolean;
}) {
  const browser = useServerBrowserState();
  useBrowserConversations();
  const status =
    browser.status?.state === "running" ? browser.status : undefined;
  const request = visits.request;
  const asking =
    owner && request && status?.request?.window === request.window
      ? request
      : undefined;
  const state: BrowserCardState = asking
    ? status?.control === "person"
      ? "control"
      : "ask"
    : working && owner
      ? "working"
      : "done";
  const mine = new Set(visits.windows ?? []);
  const open = status?.windows.filter((w) => mine.has(w.id)) ?? [];
  const agentWindow = (open.find((w) => w.agent) ?? open.at(-1))?.title;
  // The span the person controlled the browser for this turn's request.
  const span = request
    ? controlSpans(request.window)
        .filter((s) => request.at === undefined || s.from >= request.at - 60000)
        .at(-1)
    : undefined;
  return (
    <>
      <BrowserTurnCard
        state={state}
        visits={visits}
        request={asking?.text}
        agentWindow={agentWindow}
        tabsClosed={!!browser.status && mine.size > 0 && open.length === 0}
        you={span}
        busy={!!browser.busy}
        onLook={() =>
          openBrowserSheet(status?.control === "person" ? "control" : "view")
        }
        onTake={async () => {
          if (asking && (await setBrowserControl("person", asking.window)))
            openBrowserSheet("control");
        }}
        onGiveBack={() => void setBrowserControl("agent")}
      />
      {state === "done" && span?.to !== undefined ? (
        <BrowserGaveBackLine at={span.to} />
      ) : null}
    </>
  );
}
