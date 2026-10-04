import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
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
  ToolGroup,
  ToolOutput,
  ToolRow,
  UnknownEvent,
  UserMessage,
} from "../components";
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

function ReadableBlock({
  block,
  index,
  entryKey,
  agentId,
  revision,
  onLogin,
}: {
  block: HistoryBlock;
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
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
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
    case "text":
      return (
        <div>
          <Markdown text={loaded?.text ?? block.text ?? ""} />
          {control}
          {warning}
        </div>
      );
    case "thinking":
      return (
        <details>
          <summary>Ajattelu{block.redacted ? " · piilotettu" : ""}</summary>
          {block.redacted ? (
            <p>Sisältö on redaktoitu.</p>
          ) : (
            <>
              <pre>{loaded?.text ?? block.text}</pre>
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
}: {
  blocks: HistoryBlock[];
  entryKey: string;
  agentId?: string;
  revision?: string;
  onLogin?: () => void;
}) {
  return (
    <div className="ah-ordered-blocks">
      {blocks.map((block, index) => (
        <ReadableBlock
          // biome-ignore lint/suspicious/noArrayIndexKey: Native block index is stable identity within an entry.
          key={`${entryKey}:${revision}:${index}`}
          block={block}
          index={index}
          entryKey={entryKey}
          agentId={agentId}
          revision={revision}
          onLogin={onLogin}
        />
      ))}
    </div>
  );
}

export function Entry({
  entry,
  onLogin,
  agentId,
  revision,
}: {
  entry: HistoryEntry;
  onLogin?: () => void;
  agentId?: string;
  revision?: string;
}) {
  const content = entry.content;
  const [toolExpanded, setToolExpanded] = useState(false);
  const [longExpanded, setLongExpanded] = useState(false);
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
        <ToolRow
          name={content.text.split("\n", 1)[0] || "Työkalu"}
          statusLabel={entry.is_error ? "Virhe" : "Tulos valmis"}
          state="Valmis"
          expanded={toolExpanded}
          onToggle={() => setToolExpanded(!toolExpanded)}
        >
          {entry.tool_call_id ? <p>Kutsu: {entry.tool_call_id}</p> : null}
          {!entry.blocks?.length ? (
            <ToolOutput
              text={longExpanded ? content.text : content.text.slice(0, 12000)}
              streamSemantics="unknown"
              sourceState="complete"
              onCopy={copy}
            />
          ) : null}
          {entry.blocks?.length ? (
            <OrderedBlocks
              blocks={entry.blocks}
              entryKey={entry.entry_key}
              agentId={agentId}
              revision={entry.native_revision ?? revision}
              onLogin={onLogin}
            />
          ) : null}
          {!entry.blocks?.length && content.text.length > 12000 ? (
            <Button
              label={
                longExpanded ? "Supista tuloste" : "Näytä koko ladattu tuloste"
              }
              onPress={() => setLongExpanded(!longExpanded)}
            />
          ) : null}
        </ToolRow>
      ) : null}
      {entry.kind === "bash" ? (
        <section className="ah-ordered-blocks">
          <p>
            Paikallinen komento ·{" "}
            {entry.cancelled
              ? "keskeytetty"
              : entry.exit_code !== undefined
                ? `paluuarvo ${entry.exit_code}`
                : "tila ei tiedossa"}
            {entry.output_truncated ? " · tuloste katkaistu" : ""}
            {entry.exclude_from_context ? " · ei mallin kontekstissa" : ""}
          </p>
          {entry.blocks?.map((block, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Native command/output block positions are stable within an entry.
            <div key={`${entry.entry_key}:${index}`}>
              <strong>{index === 0 ? "Komento" : "Tuloste"}</strong>
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
        </section>
      ) : null}
      {entry.kind === "model_change" ? (
        <ModelChange modelId={content.text} onCopy={copy} />
      ) : null}
      {entry.kind === "unknown" ? (
        entry.blocks?.length ? (
          <section>
            <p>Pi-merkintä · {entry.entry_type ?? "tuntematon"}</p>
            <OrderedBlocks
              blocks={entry.blocks}
              entryKey={entry.entry_key}
              agentId={agentId}
              revision={entry.native_revision ?? revision}
              onLogin={onLogin}
            />
          </section>
        ) : (
          <UnknownEvent
            kindLabel="Pi-tapahtuma"
            safeSummary={
              fallback
                ? `Tapahtuman muotoa ei tueta · ${fallback.type} · ${fallback.summary.map(({ text }) => text).join(" · ") || fallback.raw}`
                : `Tapahtuman muotoa ei tueta. ${content.text}`
            }
            safePayloadText={fallback?.raw ?? content.text}
            onCopy={copy}
          />
        )
      ) : null}
    </>
  );
}
// Group only adjacent native tool results. Keys belong to the first entry so
// disclosure state survives refreshes that preserve the native event order.
export function timelineItems(
  entries: HistoryEntry[],
  onLogin?: () => void,
  agentId?: string,
  revision?: string,
) {
  const items: { id: string; kind: string; content: React.ReactNode }[] = [];
  for (let i = 0; i < entries.length; ) {
    const first = entries[i];
    if (first.kind !== "tool") {
      items.push({
        id: first.entry_key,
        kind: first.kind,
        content: (
          <Entry
            key={first.entry_key}
            entry={first}
            onLogin={onLogin}
            agentId={agentId}
            revision={revision}
          />
        ),
      });
      i++;
      continue;
    }
    const group: HistoryEntry[] = [];
    while (i < entries.length && entries[i].kind === "tool")
      group.push(entries[i++]);
    items.push({
      id: first.entry_key,
      kind: "tool",
      content: (
        <HistoryToolGroup
          key={first.entry_key}
          entries={group}
          onLogin={onLogin}
          agentId={agentId}
          revision={revision}
        />
      ),
    });
  }
  return items;
}
function HistoryToolGroup({
  entries,
  onLogin,
  agentId,
  revision,
}: {
  entries: HistoryEntry[];
  onLogin?: () => void;
  agentId?: string;
  revision?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 1)
    return (
      <Entry
        entry={entries[0]}
        onLogin={onLogin}
        agentId={agentId}
        revision={revision}
      />
    );
  return (
    <ToolGroup
      title="Työkalut"
      summary={`${entries.length} tulosta`}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {entries.map((entry) => (
        <Entry
          key={entry.entry_key}
          entry={entry}
          onLogin={onLogin}
          agentId={agentId}
          revision={revision}
        />
      ))}
    </ToolGroup>
  );
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
        <Link to={`/workspaces/${workspaceId}`}>Uusi keskustelu</Link>
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
