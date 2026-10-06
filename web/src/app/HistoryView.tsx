import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AgentFacts,
  AgentHeader,
  AssistantMessage,
  Button,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  InlineNotice,
  Markdown,
  ModelChange,
  UnknownEvent,
  UserMessage,
} from "../components";
import { PiBoundary, PiToolUse } from "../components/PiBlocks";
import { ControlButton, LinkRow } from "../components/ControlElements";
import { type ConversationStore, useWindow } from "./conversationStore";
import {
  type BlockChunk,
  type HistoryBlock,
  type HistoryEntry,
  type HistoryPage,
  readHistory,
} from "./history";
import type { Agent } from "./snapshot";
import { visibleEntryKeys } from "./useReadingPosition";

// Only the daemon's explicit fallback marker is interpreted here. Unknown data
// stays text, including malformed JSON and fields we do not recognize.
function unfamiliar(text: string): {
  type: string;
  summary: { key: string; text: string }[];
  raw: string;
} | null {
  const block = /^\[Sisältöä ei tueta: ([^\n]+?)\] (\{[\s\S]*\})$/.exec(text);
  const event = /^Tuntematon Pi-tapahtuma: ([^\n]+)\n(\{[\s\S]*\})$/.exec(text);
  const match = block ?? event;
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[2]);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  return {
    type: match[1],
    summary: ["prompt", "text", "message", "description", "payload"].flatMap(
      (key) =>
        typeof fields[key] === "string" && fields[key]
          ? [{ key, text: fields[key] as string }]
          : [],
    ),
    raw: match[2],
  };
}

// A tab-local preference changes presentation only, never the native block.
const resultEdge = new Map<string, "head" | "tail">();
function ReadableBlock({
  block,
  index,
  entryKey,
  agentId,
  revision,
  onLogin,
  toolName,
}: {
  block: HistoryBlock;
  toolName?: string;
  index: number;
  entryKey: string;
  agentId?: string;
  revision?: string;
  onLogin?: () => void;
}) {
  const [loaded, setLoaded] = useState<{
    text: string;
    offset: number;
    data: string;
    complete: boolean;
    mediaType: string;
  }>();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [edge, setEdge] = useState<"head" | "tail">(
    resultEdge.get(toolName ?? "") ?? (toolName === "bash" ? "tail" : "head"),
  );
  const request = useRef<AbortController | null>(null);
  const preview = useRef<HTMLPreElement | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (preview.current && toolName)
      preview.current.scrollTop =
        edge === "tail" ? preview.current.scrollHeight : 0;
  }, [edge, toolName]);
  const more = async () => {
    if (!agentId || !revision || pending) return;
    setPending(true);
    setFailed(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      let next = loaded;
      // Images cannot render until their base64 payload is complete. A single
      // action fetches a normal-sized image; larger ones retain a page control.
      // Every image response is limited to 1 MiB, text to 64 KiB.
      const batch = block.type === "image" ? 8 : 1;
      for (let page = 0; page < batch; page++) {
        const offset = next?.offset ?? 0;
        const url = `/api/v1/agents/${agentId}/entries/${entryKey}/blocks/${index}?${new URLSearchParams({ revision, offset: String(offset), limit_bytes: block.type === "image" ? "1048576" : "65536" })}`;
        const response = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const value = await readHistory(response);
        if (!("chunk" in value)) throw new Error("invalid block");
        const chunk = value as BlockChunk;
        if (
          chunk.agent_id !== agentId ||
          chunk.native_revision !== revision ||
          chunk.entry_key !== entryKey ||
          chunk.block_index !== index ||
          chunk.offset !== offset ||
          (!chunk.chunk.complete &&
            (chunk.chunk.next_offset === undefined ||
              chunk.chunk.next_offset <= offset)) ||
          (next && chunk.chunk.media_type !== next.mediaType)
        )
          throw new Error("invalid block");
        const text = (next?.text ?? "") + (chunk.chunk.text ?? "");
        const data = (next?.data ?? "") + (chunk.chunk.data ?? "");
        if (text.length + data.length > 64 * 1024 * 1024)
          throw new Error("oversize block");
        next = {
          text,
          data,
          offset: chunk.chunk.next_offset ?? offset,
          complete: chunk.chunk.complete,
          mediaType: chunk.chunk.media_type,
        };
        if (controller.signal.aborted) return;
        setLoaded(next);
        if (next.complete) break;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if ((error as Error).message === "identity_lost") onLogin?.();
      else setFailed(true);
    } finally {
      request.current = null;
      setPending(false);
    }
  };
  const control =
    block.readable && agentId && revision && !loaded?.complete ? (
      <Button
        label={
          pending
            ? "Ladataan…"
            : loaded
              ? "Lataa lisää lohkoa"
              : "Lataa lohkon sisältö"
        }
        pending={pending}
        onPress={more}
      />
    ) : null;
  const warning = failed ? (
    <InlineNotice
      title="Lohkon sisältöä ei saatu"
      description="Lähde on voinut muuttua. Päivitä historia."
      tone="warning"
    />
  ) : null;
  switch (block.type) {
    case "text": {
      const text = loaded?.text ?? block.text ?? "";
      const whole = loaded?.complete || !block.readable;
      return (
        <div className={toolName ? "ah-pi-result" : undefined}>
          {toolName ? (
            <fieldset className="ah-pi-edge">
              <legend>{toolName} · esikatselun kohta</legend>
              {(["head", "tail"] as const).map((option) => (
                <ControlButton
                  variant="quiet"
                  size="compact"
                  key={option}
                  aria-pressed={edge === option}
                  onPress={() => {
                    resultEdge.set(toolName, option);
                    setEdge(option);
                  }}
                >
                  {option === "head" ? "Alku" : "Loppu"}
                </ControlButton>
              ))}
            </fieldset>
          ) : null}
          {toolName ? (
            <pre ref={preview}>{text}</pre>
          ) : (
            <Markdown text={text} />
          )}
          {toolName && edge === "tail" && !whole ? (
            <PiBoundary>
              Loppu ei ole vielä saatavilla; näkyvissä ladattu alku.
            </PiBoundary>
          ) : null}
          {block.readable && !loaded?.complete ? (
            <PiBoundary>
              Esikatselu päättyy tähän · lisää natiivista lohkoluvulla
            </PiBoundary>
          ) : null}
          {control}
          {warning}
        </div>
      );
    }
    case "thinking":
      return (
        <details>
          <summary>Ajattelu{block.redacted ? " · piilotettu" : ""}</summary>
          {block.redacted ? (
            <p>Sisältö on redaktoitu.</p>
          ) : (
            <>
              <pre>{loaded?.text ?? block.text}</pre>
              {block.readable && !loaded?.complete ? (
                <PiBoundary>Esikatselu päättyy tähän</PiBoundary>
              ) : null}
              {control}
              {warning}
            </>
          )}
        </details>
      );
    case "image":
      return (
        <div>
          <p>Kuva · {block.mime_type || "tuntematon muoto"}</p>
          {loaded?.complete &&
          loaded.data &&
          ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
            loaded.mediaType,
          ) ? (
            <img
              alt="Pi-viestin kuva"
              src={`data:${loaded.mediaType};base64,${loaded.data}`}
            />
          ) : null}
          {control}
          {warning}
        </div>
      );
    case "toolCall":
      return (
        <details>
          <summary>
            Työkalukutsu · {block.tool_name || "tuntematon"} ·{" "}
            {block.tool_call_id || "ei tunnistetta"}
          </summary>
          {loaded?.text ? <pre>{loaded.text}</pre> : null}
          {control}
          {warning}
        </details>
      );
    default:
      return <p>Tuntematon sisältölohko (sisältöä ei näytetä)</p>;
  }
}
function OrderedBlocks({
  blocks,
  entryKey,
  agentId,
  revision,
  onLogin,
  results,
  liveTools,
  toolName,
}: {
  blocks: HistoryBlock[];
  toolName?: string;
  liveTools?: Map<string, LiveTool>;
  results?: Map<string, HistoryEntry>;
  entryKey: string;
  agentId?: string;
  revision?: string;
  onLogin?: () => void;
}) {
  return (
    <div className="ah-ordered-blocks">
      {blocks.map((block, index) =>
        block.type === "toolCall" && block.tool_call_id ? (
          <PiToolUse
            key={`${entryKey}:${revision}:${block.tool_call_id}`}
            name={block.tool_name || "Työkalu"}
            state={
              results?.get(block.tool_call_id)?.is_error
                ? "failed"
                : results?.has(block.tool_call_id)
                  ? "succeeded"
                  : toolState(liveTools?.get(block.tool_call_id)?.state)
            }
          >
            <strong>Argumentit</strong>
            <ReadableBlock
              block={block}
              index={index}
              entryKey={entryKey}
              agentId={agentId}
              revision={revision}
              onLogin={onLogin}
            />
            {liveTools?.get(block.tool_call_id)?.output &&
            !results?.has(block.tool_call_id) ? (
              <>
                <strong>Viimeisin päivitys</strong>
                <pre>{liveTools.get(block.tool_call_id)?.output}</pre>
              </>
            ) : null}
            {results?.get(block.tool_call_id) ? (
              <>
                <strong>Tulos</strong>
                <ResultBlocks
                  entry={results.get(block.tool_call_id) as HistoryEntry}
                  agentId={agentId}
                  revision={revision}
                  onLogin={onLogin}
                />
              </>
            ) : null}
          </PiToolUse>
        ) : (
          <ReadableBlock
            // biome-ignore lint/suspicious/noArrayIndexKey: Native block index is stable identity within an entry.
            key={`${entryKey}:${revision}:${index}`}
            block={block}
            toolName={toolName}
            index={index}
            entryKey={entryKey}
            agentId={agentId}
            revision={revision}
            onLogin={onLogin}
          />
        ),
      )}
    </div>
  );
}

export function Entry({
  entry,
  onLogin,
  agentId,
  revision,
  results,
  liveTools,
}: {
  entry: HistoryEntry;
  liveTools?: Map<string, LiveTool>;
  results?: Map<string, HistoryEntry>;
  onLogin?: () => void;
  agentId?: string;
  revision?: string;
}) {
  const content = entry.content;
  const copy = () => void navigator.clipboard?.writeText(content.text);
  const fallback =
    entry.kind === "assistant" || entry.kind === "unknown"
      ? unfamiliar(content.text)
      : null;
  return (
    <>
      {entry.kind === "user" ? (
        <UserMessage sourceText={content.text} onCopy={copy}>
          {entry.blocks?.length ? (
            <OrderedBlocks
              blocks={entry.blocks}
              results={results}
              liveTools={liveTools}
              entryKey={entry.entry_key}
              agentId={agentId}
              revision={entry.native_revision ?? revision}
              onLogin={onLogin}
            />
          ) : undefined}
        </UserMessage>
      ) : null}
      {/* Native history omits the stop reason; a saved tool-use message may
          precede the rest of a still-running turn. */}
      {entry.kind === "assistant" ? (
        <AssistantMessage
          onCopy={copy}
          modelLabel={entry.model}
          streamState={entry.stop_reason === "error" ? "failed" : undefined}
        >
          {entry.blocks ? (
            <OrderedBlocks
              blocks={entry.blocks}
              results={results}
              liveTools={liveTools}
              entryKey={entry.entry_key}
              agentId={agentId}
              revision={entry.native_revision ?? revision}
              onLogin={onLogin}
            />
          ) : fallback ? (
            <section className="ah-unknown">
              <p>Tuntematon sisältö · {fallback.type}</p>
              {fallback.summary.length ? (
                fallback.summary.map(({ key, text }) => <p key={key}>{text}</p>)
              ) : (
                <p>{fallback.raw}</p>
              )}
              <details>
                <summary>Näytä alkuperäinen sisältö</summary>
                <pre>{fallback.raw}</pre>
              </details>
            </section>
          ) : (
            <Markdown text={content.text} />
          )}
        </AssistantMessage>
      ) : null}
      {entry.kind === "tool" ? (
        <PiToolUse
          name={entry.content.text.split("\n", 1)[0] || "Työkalu"}
          state={entry.is_error ? "failed" : "succeeded"}
        >
          <ResultBlocks
            entry={entry}
            agentId={agentId}
            revision={revision}
            onLogin={onLogin}
          />
        </PiToolUse>
      ) : null}
      {entry.kind === "bash" ? (
        <section
          className="ah-pi-local"
          aria-label="Sinä · paikallinen komento"
        >
          <header>
            <strong>Sinä · paikallinen komento</strong>
            {entry.exclude_from_context ? (
              <span>ei mallin kontekstissa</span>
            ) : null}
            <span>
              {entry.cancelled
                ? "peruttu"
                : entry.exit_code !== undefined
                  ? `paluuarvo ${entry.exit_code}`
                  : "tila ei tiedossa"}
            </span>
          </header>
          {entry.blocks?.map((block, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Native command/output block positions are stable within an entry.
            <div key={`${entry.entry_key}:${index}`}>
              {index === 0 ? (
                <strong>Komento</strong>
              ) : (
                <strong>Tuloste</strong>
              )}
              <ReadableBlock
                block={block}
                index={index}
                entryKey={entry.entry_key}
                agentId={agentId}
                revision={entry.native_revision ?? revision}
                onLogin={onLogin}
              />
            </div>
          ))}
          {entry.output_truncated ? (
            <PiBoundary>
              Pi katkaisi paikallisen komennon tulosteen · saatavilla oleva osa
              näkyy
            </PiBoundary>
          ) : null}
        </section>
      ) : null}
      {entry.kind === "model_change" ? (
        <ModelChange modelId={content.text} onCopy={copy} />
      ) : null}
      {entry.kind === "unknown" ? (
        entry.entry_type ? (
          <aside className="ah-pi-marker" role="note">
            <span>
              {(
                {
                  compaction: "Keskustelu tiivistettiin",
                  branch_summary: "Haaran tiivistelmä",
                  thinking_level_change: "Ajattelutaso vaihtui",
                  session_info: "Keskustelun tieto",
                  label: "Merkintä",
                } as Record<string, string>
              )[entry.entry_type] ?? "Pi-merkintä"}
            </span>
            {entry.blocks?.length ? (
              <OrderedBlocks
                blocks={entry.blocks}
                entryKey={entry.entry_key}
                agentId={agentId}
                revision={entry.native_revision ?? revision}
                onLogin={onLogin}
              />
            ) : null}
          </aside>
        ) : (
          <UnknownEvent
            kindLabel="Pi-tapahtuma"
            safeSummary={`Sisältöä ei tueta · ${entry.entry_type ?? "tuntematon"}`}
            onCopy={copy}
          />
        )
      ) : null}
    </>
  );
}
function ResultBlocks({
  entry,
  agentId,
  revision,
  onLogin,
}: {
  entry: HistoryEntry;
  agentId?: string;
  revision?: string;
  onLogin?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (entry.blocks?.length)
    return (
      <OrderedBlocks
        blocks={entry.blocks}
        toolName={entry.content.text.split("\n", 1)[0] || "Työkalu"}
        entryKey={entry.entry_key}
        agentId={agentId}
        revision={entry.native_revision ?? revision}
        onLogin={onLogin}
      />
    );
  const text = entry.content.text;
  return (
    <div className="ah-pi-result">
      <pre>{expanded ? text : text.slice(0, 12000)}</pre>
      {text.length > 12000 ? (
        <>
          <PiBoundary>Esikatselu päättyy tähän</PiBoundary>
          <Button
            label={expanded ? "Supista tuloste" : "Näytä koko ladattu tuloste"}
            onPress={() => setExpanded(!expanded)}
          />
        </>
      ) : null}
    </div>
  );
}

// Place results at their native call position; an orphan result (e.g. the
// previous history page holds the call) still has its own accessible row.
function toolState(
  state?: string,
): "forming" | "running" | "succeeded" | "failed" | "cancelled" | "unknown" {
  return state === "forming" ||
    state === "running" ||
    state === "succeeded" ||
    state === "failed" ||
    state === "cancelled"
    ? state
    : "unknown";
}
export type LiveTool = {
  callId?: string;
  name?: string;
  state?: string;
  arguments?: string;
  output?: string;
};
export function timelineItems(
  entries: HistoryEntry[],
  onLogin?: () => void,
  agentId?: string,
  revision?: string,
  liveTools?: Map<string, LiveTool>,
) {
  const results = new Map<string, HistoryEntry>();
  const calls = new Set<string>();
  for (const entry of entries)
    if (entry.kind === "assistant")
      for (const block of entry.blocks ?? [])
        if (block.type === "toolCall" && block.tool_call_id)
          calls.add(block.tool_call_id);
  for (const entry of entries)
    if (
      entry.kind === "tool" &&
      entry.tool_call_id &&
      calls.has(entry.tool_call_id)
    )
      results.set(entry.tool_call_id, entry);
  return entries
    .filter(
      (entry) =>
        !entry.tool_call_id || results.get(entry.tool_call_id) !== entry,
    )
    .map((entry) => ({
      id: entry.entry_key,
      kind: entry.kind,
      content: (
        <Entry
          key={entry.entry_key}
          entry={entry}
          results={results}
          liveTools={liveTools}
          onLogin={onLogin}
          agentId={agentId}
          revision={revision}
        />
      ),
    }));
}
export function HistoryView({
  agent,
  workspaceName,
  workspaceId,
  onLogin,
  store,
}: {
  agent: Agent;
  workspaceName: string;
  workspaceId: string;
  onLogin: () => void;
  store: ConversationStore;
}) {
  const window = useWindow(store, agent.agent_id);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const cached = store.read(agent.agent_id);
    store.view(agent.agent_id);
    // Terminal histories have no controller events to fall back on. Re-read a
    // warm window on opening if the daemon's file watcher stopped unexpectedly.
    if (cached && !["loading", "error"].includes(cached.state))
      void store.reconnect(agent.agent_id);
  }, [agent.agent_id, store]);
  const entries = window?.entries ?? [];
  const stream = useRef<HTMLElement>(null);
  const anchor = useRef<{ key: string; offset: number } | undefined>(
    store.position(agent.agent_id),
  );
  const capture = () => {
    const viewport = stream.current;
    if (!viewport) return;
    const top = viewport.getBoundingClientRect().top;
    const rows = viewport.querySelectorAll<HTMLElement>(".ah-feed > li");
    const keys = visibleEntryKeys(entries);
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (rect.bottom > top && keys[i]) {
        anchor.current = { key: keys[i], offset: rect.top - top };
        store.savePosition(agent.agent_id, anchor.current);
        break;
      }
    }
  };
  useLayoutEffect(() => {
    const viewport = stream.current;
    const saved = anchor.current;
    if (!viewport || !saved) return;
    const index = visibleEntryKeys(entries).indexOf(saved.key);
    const row = viewport.querySelectorAll<HTMLElement>(".ah-feed > li")[index];
    if (row)
      viewport.scrollTop +=
        row.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        saved.offset;
  }, [entries]);
  const state =
    agent.history !== "readable" ? "error" : (window?.state ?? "loading");
  const loadMore = async () => {
    if (!window?.next || busy) return;
    capture();
    setBusy(true);
    try {
      await store.older(agent.agent_id);
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else store.markStale(agent.agent_id);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConversationFrame>
      <AgentHeader
        title={agent.title.display}
        activityLabel="Prosessin tila ei tiedossa"
        activityKind="unknown"
        controlKind="read-only"
        controlLabel="Vain luku · Ohjausta ei ole"
        workspaceLabel={workspaceName}
        workspaceHref={`/workspaces/${workspaceId}`}
        detailsExpanded={details}
        onToggleDetails={() => setDetails(!details)}
      />
      {details ? (
        <AgentFacts
          facts={[
            { label: "Natiivi tunniste", value: agent.agent_id },
            { label: "Historia", value: agent.history },
            { label: "Prosessi", value: agent.process, state: "unknown" },
            { label: "Ohjaus", value: "Vain luku" },
          ]}
        />
      ) : null}
      <ConversationStream streamRef={stream} onScroll={capture}>
        <ConversationTimeline
          state={state}
          items={timelineItems(
            entries,
            onLogin,
            agent.agent_id,
            window?.revision,
          )}
          historyMode="pagedAccessible"
          emptyLabel="Natiivissa historiassa ei ole vielä viestejä."
          onJumpToLatest={() => {}}
          problem={{
            title: "Historiaa ei saada",
            description:
              "Lähde puuttuu, on vioittunut tai muuttui lukemisen aikana. Päivitä tilannekuva.",
          }}
        />
        {window?.next && state !== "error" ? (
          <Button
            label={busy ? "Ladataan…" : "Lataa seuraava sivu"}
            pending={busy}
            onPress={loadMore}
          />
        ) : null}
      </ConversationStream>
      <div className="ah-read-only-footer">
        <div>
          <strong>Vain luku</strong>
          <p>Tätä keskustelua ei voi ohjata selaimesta.</p>
        </div>
        <LinkRow href={`/workspaces/${workspaceId}`} kind="inline">
          Uusi keskustelu
        </LinkRow>
      </div>
    </ConversationFrame>
  );
}
export async function readHistoryFetch(
  agentId: string,
  after?: string,
  signal?: AbortSignal,
): Promise<HistoryPage> {
  const query = new URLSearchParams({ limit: "25" });
  query.set("after", after ?? "");
  const response = await fetch(`/api/v1/agents/${agentId}/history?${query}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 404) throw new Error("history_missing");
  const result = await readHistory(response);
  if (!("entries" in result) || result.agent_id !== agentId)
    throw new Error("invalid page");
  return result;
}
