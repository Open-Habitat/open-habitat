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
  type ContentChunk,
  type HistoryEntry,
  type HistoryPage,
  readHistory,
} from "./history";
import type { Agent } from "./snapshot";

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

export function Entry({
  entry,
  onLogin,
}: {
  entry: HistoryEntry;
  onLogin?: () => void;
}) {
  const [content, setContent] = useState(entry.content);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [toolExpanded, setToolExpanded] = useState(false);
  const [longExpanded, setLongExpanded] = useState(false);
  useEffect(() => {
    setContent(entry.content);
    setFailed(false);
  }, [entry]);
  const copy = () => void navigator.clipboard?.writeText(content.text);
  const more = async () => {
    if (!content.content_id || content.next_offset === undefined || pending)
      return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/v1/content/${content.content_id}?offset=${content.next_offset}&limit_bytes=65536`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const chunk = (await readHistory(response)) as ContentChunk;
      if (
        chunk.content_id !== content.content_id ||
        chunk.offset !== content.next_offset ||
        chunk.content.text.length === 0
      )
        throw new Error("invalid chunk");
      setContent({ ...chunk.content, text: content.text + chunk.content.text });
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin?.();
      else setFailed(true);
    } finally {
      setPending(false);
    }
  };
  const fallback =
    entry.kind === "assistant" || entry.kind === "unknown"
      ? unfamiliar(content.text)
      : null;
  const continuation = !content.complete ? (
    <Button
      label={pending ? "Ladataan…" : "Lataa lisää sisältöä"}
      onPress={more}
      pending={pending}
    />
  ) : null;
  return (
    <>
      {entry.kind === "user" ? (
        <UserMessage sourceText={content.text} onCopy={copy} />
      ) : null}
      {/* Native history omits the stop reason; a saved tool-use message may
          precede the rest of a still-running turn. */}
      {entry.kind === "assistant" ? (
        <AssistantMessage onCopy={copy}>
          {fallback ? (
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
          statusLabel={content.complete ? "Tulos valmis" : "Tulosta lisää"}
          state={content.complete ? "Valmis" : "Jatkuu"}
          expanded={toolExpanded}
          onToggle={() => setToolExpanded(!toolExpanded)}
        >
          <ToolOutput
            text={longExpanded ? content.text : content.text.slice(0, 12000)}
            streamSemantics="unknown"
            sourceState={content.complete ? "complete" : "continued"}
            onCopy={copy}
            onLoadMore={more}
          />
          {content.text.length > 12000 ? (
            <Button
              label={
                longExpanded ? "Supista tuloste" : "Näytä koko ladattu tuloste"
              }
              onPress={() => setLongExpanded(!longExpanded)}
            />
          ) : null}
        </ToolRow>
      ) : null}
      {entry.kind === "model_change" ? (
        <ModelChange modelId={content.text} onCopy={copy} />
      ) : null}
      {entry.kind === "unknown" ? (
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
      ) : null}
      {entry.kind !== "tool" ? continuation : null}
      {failed ? (
        <InlineNotice
          title="Sisällön jatkoa ei saatu"
          description="Lähde on voinut muuttua. Päivitä historia."
          tone="warning"
        />
      ) : null}
    </>
  );
}
// Group only adjacent native tool results. Keys belong to the first entry so
// disclosure state survives refreshes that preserve the native event order.
export function timelineItems(entries: HistoryEntry[], onLogin?: () => void) {
  const items: { id: string; kind: string; content: React.ReactNode }[] = [];
  for (let i = 0; i < entries.length; ) {
    const first = entries[i];
    if (first.kind !== "tool") {
      items.push({
        id: first.entry_key,
        kind: first.kind,
        content: (
          <Entry key={first.entry_key} entry={first} onLogin={onLogin} />
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
        />
      ),
    });
  }
  return items;
}
function HistoryToolGroup({
  entries,
  onLogin,
}: {
  entries: HistoryEntry[];
  onLogin?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 1)
    return <Entry entry={entries[0]} onLogin={onLogin} />;
  return (
    <ToolGroup
      title="Työkalut"
      summary={`${entries.length} tulosta`}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {entries.map((entry) => (
        <Entry key={entry.entry_key} entry={entry} onLogin={onLogin} />
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
    store.view(agent.agent_id);
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
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (rect.bottom > top && entries[i]) {
        anchor.current = { key: entries[i].entry_key, offset: rect.top - top };
        store.savePosition(agent.agent_id, anchor.current);
        break;
      }
    }
  };
  useLayoutEffect(() => {
    const viewport = stream.current;
    const saved = anchor.current;
    if (!viewport || !saved) return;
    const index = entries.findIndex((entry) => entry.entry_key === saved.key);
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
          items={timelineItems(entries, onLogin)}
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
