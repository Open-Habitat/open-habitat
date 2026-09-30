import { useEffect, useRef, useState } from "react";
import {
  AgentFacts,
  AgentHeader,
  AssistantMessage,
  Button,
  ModelChange,
  ConversationTimeline,
  ConversationFrame,
  ConversationStream,
  InlineNotice,
  Markdown,
  ToolOutput,
  ToolRow,
  ToolGroup,
  UnknownEvent,
  UserMessage,
} from "../components";
import type { Agent } from "./snapshot";
import {
  readHistory,
  type ContentChunk,
  type HistoryEntry,
  type HistoryPage,
} from "./history";

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
  stale = false,
}: {
  entry: HistoryEntry;
  stale?: boolean;
}) {
  const staleRef = useRef(stale);
  staleRef.current = stale;
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
    if (
      staleRef.current ||
      !content.content_id ||
      content.next_offset === undefined ||
      pending
    )
      return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/v1/content/${content.content_id}?offset=${content.next_offset}&limit_bytes=65536`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const chunk = (await readHistory(response)) as ContentChunk;
      if (staleRef.current) return;
      if (
        chunk.content_id !== content.content_id ||
        chunk.offset !== content.next_offset ||
        chunk.content.text.length === 0
      )
        throw new Error("invalid chunk");
      setContent({ ...chunk.content, text: content.text + chunk.content.text });
    } catch {
      if (!staleRef.current) setFailed(true);
    } finally {
      setPending(false);
    }
  };
  const fallback =
    entry.kind === "assistant" || entry.kind === "unknown"
      ? unfamiliar(content.text)
      : null;
  const continuation =
    !stale && !content.complete ? (
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
            onLoadMore={stale ? undefined : more}
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
export function timelineItems(entries: HistoryEntry[], stale: boolean) {
  const items: { id: string; kind: string; content: React.ReactNode }[] = [];
  for (let i = 0; i < entries.length; ) {
    const first = entries[i];
    if (first.kind !== "tool") {
      items.push({
        id: first.entry_key,
        kind: first.kind,
        content: <Entry key={first.entry_key} entry={first} stale={stale} />,
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
        <HistoryToolGroup key={first.entry_key} entries={group} stale={stale} />
      ),
    });
  }
  return items;
}
function HistoryToolGroup({
  entries,
  stale,
}: {
  entries: HistoryEntry[];
  stale: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 1) return <Entry entry={entries[0]} stale={stale} />;
  return (
    <ToolGroup
      title="Työkalut"
      summary={`${entries.length} tulosta`}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {entries.map((entry) => (
        <Entry key={entry.entry_key} entry={entry} stale={stale} />
      ))}
    </ToolGroup>
  );
}
export function HistoryView({
  agent,
  workspaceName,
  workspaceId,
  stale = false,
}: {
  stale?: boolean;
  agent: Agent;
  workspaceName: string;
  workspaceId: string;
}) {
  const staleRef = useRef(stale);
  staleRef.current = stale;
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );
  const [next, setNext] = useState<string>();
  const [revision, setRevision] = useState<string>();
  const [sourceUpdated, setSourceUpdated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    // Do not load a new history from an unverified connection. A mounted
    // history remains readable, but a newly selected one waits for retry.
    if (stale) return;
    const controller = new AbortController();
    setEntries([]);
    setNext(undefined);
    setRevision(undefined);
    setSourceUpdated(false);
    setState("loading");
    if (agent.history !== "readable") {
      setState("error");
      return () => controller.abort();
    }
    readHistoryFetch(agent.agent_id, undefined, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setEntries(page.entries);
        setNext(page.next_after);
        setRevision(page.native_revision);
        setState(page.entries.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [agent.agent_id, agent.history, stale]);
  const loadMore = async () => {
    if (stale || !next || busy) return;
    setBusy(true);
    try {
      const page = await readHistoryFetch(agent.agent_id, next);
      if (staleRef.current) return;
      if (
        page.entries.some((e) =>
          entries.some((old) => old.entry_key === e.entry_key),
        )
      )
        throw new Error("changed source");
      if (page.native_revision !== revision) setSourceUpdated(true);
      setRevision(page.native_revision);
      setEntries([...entries, ...page.entries]);
      setNext(page.next_after);
    } catch {
      if (!staleRef.current) setState("error");
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
      <ConversationStream>
        <ConversationTimeline
          state={state}
          items={timelineItems(entries, stale)}
          historyMode="pagedAccessible"
          emptyLabel="Natiivissa historiassa ei ole vielä viestejä."
          onJumpToLatest={() => {}}
          problem={{
            title: "Historiaa ei saada",
            description:
              "Lähde puuttuu, on vioittunut tai muuttui lukemisen aikana. Päivitä tilannekuva.",
          }}
        />
      </ConversationStream>
      {sourceUpdated ? (
        <InlineNotice
          title="Lähde päivittyi"
          description="Pi kirjoitti historiaan sivujen välillä. Natiivijärjestys säilyy; päivitä tarvittaessa."
          tone="warning"
        />
      ) : null}
      {next && state !== "error" && !stale ? (
        <Button
          label={busy ? "Ladataan…" : "Lataa seuraava sivu"}
          pending={busy}
          onPress={loadMore}
        />
      ) : null}
      <InlineNotice
        title="Vain luku"
        description="Historian avaaminen ei käynnistä eikä jatka Pi:tä. Prosessia tai ohjauskanavaa ei ole vahvistettu."
      />
    </ConversationFrame>
  );
}
export async function readHistoryFetch(
  agentId: string,
  after?: string,
  signal?: AbortSignal,
): Promise<HistoryPage> {
  const query = new URLSearchParams({ limit: "25" });
  if (after) query.set("after", after);
  const response = await fetch(`/api/v1/agents/${agentId}/history?${query}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const result = await readHistory(response);
  if (!("entries" in result) || result.agent_id !== agentId)
    throw new Error("invalid page");
  return result;
}
