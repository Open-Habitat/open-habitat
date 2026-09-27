import { useEffect, useState } from "react";
import {
  AgentFacts,
  AgentHeader,
  AssistantMessage,
  Button,
  CodeBlock,
  ConversationTimeline,
  InlineNotice,
  ToolOutput,
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

function Entry({ entry }: { entry: HistoryEntry }) {
  const [content, setContent] = useState(entry.content);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
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
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
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
      {entry.kind === "assistant" ? (
        <AssistantMessage streamState="unknown" onCopy={copy}>
          <pre>{content.text}</pre>
        </AssistantMessage>
      ) : null}
      {entry.kind === "tool" ? (
        <ToolOutput
          text={content.text}
          streamSemantics="unknown"
          sourceState={content.complete ? "complete" : "continued"}
          onCopy={copy}
          onLoadMore={more}
        />
      ) : null}
      {entry.kind === "model_change" ? (
        <CodeBlock
          text={content.text}
          languageLabel="Mallin vaihto"
          onCopy={copy}
        />
      ) : null}
      {entry.kind === "unknown" ? (
        <UnknownEvent
          kindLabel="Pi-tapahtuma"
          safeSummary="Tapahtuman muotoa ei tueta."
          safePayloadText={content.text}
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
export function HistoryView({
  agent,
  workspaceName,
  workspaceId,
}: {
  agent: Agent;
  workspaceName: string;
  workspaceId: string;
}) {
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
  }, [agent.agent_id, agent.history]);
  const loadMore = async () => {
    if (!next || busy) return;
    setBusy(true);
    try {
      const page = await readHistoryFetch(agent.agent_id, next);
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
      setState("error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <AgentHeader
        title={agent.title.display}
        activityLabel="Prosessin tila ei tiedossa"
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
      <ConversationTimeline
        state={state}
        items={entries.map((entry) => ({
          id: entry.entry_key,
          content: <Entry key={entry.entry_key} entry={entry} />,
        }))}
        historyMode="pagedAccessible"
        emptyLabel="Natiivissa historiassa ei ole vielä viestejä."
        onJumpToLatest={() => {}}
        problem={{
          title: "Historiaa ei saada",
          description:
            "Lähde puuttuu, on vioittunut tai muuttui lukemisen aikana. Päivitä tilannekuva.",
        }}
      />
      {sourceUpdated ? (
        <InlineNotice
          title="Lähde päivittyi"
          description="Pi kirjoitti historiaan sivujen välillä. Natiivijärjestys säilyy; päivitä tarvittaessa."
          tone="warning"
        />
      ) : null}
      {next && state !== "error" ? (
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
    </section>
  );
}
async function readHistoryFetch(
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
