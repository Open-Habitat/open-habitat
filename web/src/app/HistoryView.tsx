import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AgentHeader,
  AssistantMessage,
  Button,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  InlineNotice,
  Markdown,
  UnknownEvent,
  UserMessage,
} from "../components";
import { AgentTurn, ThinkingRow } from "../components/AgentTurn";
import { BashToolCard } from "../components/BashToolCard";
import { ControlButton, LinkRow } from "../components/ControlElements";
import { ArchiveControls } from "../components/ArchiveControls";
import { RecapCard } from "../components/RecapCard";
import { PiBoundary, PiToolUse } from "../components/PiBlocks";
import { type ConversationStore, useWindow } from "./conversationStore";
import {
  continueConversation,
  historyEligibility,
  retitleHistory,
  readRecap,
} from "./conversations";
import { useNavigate } from "react-router";
import {
  type BlockChunk,
  type HistoryBlock,
  type HistoryEntry,
  type HistoryPage,
  readHistory,
} from "./history";
import type { Agent } from "./snapshot";
import {
  hiddenSessionEntry,
  latestSettings,
  sessionMarkers,
  type SessionMarker,
} from "./sessionSettings";
import { rowIndexOf, visibleEntryKeys } from "./useReadingPosition";

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
  const displayedText = loaded?.text ?? block.text ?? "";
  useEffect(() => () => request.current?.abort(), []);
  useLayoutEffect(() => {
    if (preview.current && toolName && displayedText.length)
      preview.current.scrollTop =
        edge === "tail" ? preview.current.scrollHeight : 0;
  }, [edge, toolName, displayedText]);
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
      const text = displayedText;
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
        <div>
          <ThinkingRow
            text={loaded?.text ?? block.text ?? ""}
            redacted={block.redacted}
          />
          {control}
          {warning}
        </div>
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
          <summary>{block.tool_name || "Työkalu"} · argumentit</summary>
          {loaded?.text ? <pre>{loaded.text}</pre> : null}
          {control}
          {warning}
        </details>
      );
    default:
      return <p>Tuntematon sisältölohko (sisältöä ei näytetä)</p>;
  }
}
function bashCommand(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "command" in parsed &&
      typeof parsed.command === "string"
    )
      return parsed.command;
  } catch {
    /* Show opaque native arguments as text. */
  }
  return value;
}
function BashCall({
  block,
  index,
  entryKey,
  agentId,
  revision,
  output,
  running,
  onLogin,
  onCommand,
}: {
  block: HistoryBlock;
  onCommand?: (id: string, command: string) => void;
  index: number;
  entryKey: string;
  agentId?: string;
  revision?: string;
  output?: string;
  running: boolean;
  onLogin?: () => void;
}) {
  const [command, setCommand] = useState(block.text ?? "");
  const [error, setError] = useState(false);
  const [partial, setPartial] = useState(false);
  useEffect(() => {
    if (!block.readable || !agentId || !revision) return;
    const controller = new AbortController();
    const url = `/api/v1/agents/${agentId}/entries/${entryKey}/blocks/${index}?${new URLSearchParams({ revision, offset: "0", limit_bytes: "65536" })}`;
    void fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readHistory)
      .then((value) => {
        if (
          !("chunk" in value) ||
          value.agent_id !== agentId ||
          value.native_revision !== revision ||
          value.entry_key !== entryKey ||
          value.block_index !== index ||
          value.offset !== 0 ||
          value.chunk.media_type !== "text/plain"
        )
          throw new Error("invalid block");
        if (!controller.signal.aborted) {
          setCommand(value.chunk.text ?? "");
          if (block.tool_call_id)
            onCommand?.(
              block.tool_call_id,
              bashCommand(value.chunk.text ?? "").split("\n")[0],
            );
          setPartial(!value.chunk.complete);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if ((error as Error).message === "identity_lost") onLogin?.();
        else setError(true);
      });
    return () => controller.abort();
  }, [
    block.readable,
    block.tool_call_id,
    agentId,
    revision,
    entryKey,
    index,
    onLogin,
    onCommand,
  ]);
  return (
    <>
      <BashToolCard
        command={bashCommand(command)}
        output={output}
        running={running}
      />
      {error ? (
        <PiBoundary>Komennon sisältöä ei saatu. Päivitä historia.</PiBoundary>
      ) : null}
      {partial ? (
        <PiBoundary>Komennon esikatselu päättyy tähän.</PiBoundary>
      ) : null}
    </>
  );
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
  toolExpansion,
}: {
  blocks: HistoryBlock[];
  toolExpansion?: (callId: string) => {
    get: () => boolean | undefined;
    set: (value: boolean) => void;
  };
  toolName?: string;
  liveTools?: Map<string, LiveTool>;
  results?: Map<string, HistoryEntry>;
  entryKey: string;
  agentId?: string;
  revision?: string;
  onLogin?: () => void;
}) {
  const [commands, setCommands] = useState<Record<string, string>>({});
  const onCommand = useCallback(
    (id: string, text: string) =>
      setCommands((previous) =>
        previous[id] === text ? previous : { ...previous, [id]: text },
      ),
    [],
  );
  return (
    <div className="ah-ordered-blocks">
      {blocks.map((block, index) =>
        block.type === "toolCall" && block.tool_call_id ? (
          <PiToolUse
            key={`${entryKey}:${revision}:${block.tool_call_id}`}
            name={block.tool_name || "Työkalu"}
            initiallyExpanded={false}
            expansion={toolExpansion?.(block.tool_call_id)}
            targetText={
              block.tool_name === "bash"
                ? (commands[block.tool_call_id] ??
                  (block.text
                    ? bashCommand(block.text).split("\n")[0]
                    : undefined))
                : undefined
            }
            state={
              results?.get(block.tool_call_id)?.is_error
                ? "failed"
                : results?.has(block.tool_call_id)
                  ? "succeeded"
                  : toolState(liveTools?.get(block.tool_call_id)?.state)
            }
          >
            {block.tool_name === "bash" ? (
              <BashCall
                onCommand={onCommand}
                block={block}
                index={index}
                entryKey={entryKey}
                agentId={agentId}
                revision={revision}
                output={
                  results
                    ?.get(block.tool_call_id)
                    ?.blocks?.filter((b) => b.type === "text")
                    .map((b) => b.text ?? "")
                    .join("\n") ?? liveTools?.get(block.tool_call_id)?.output
                }
                running={!results?.has(block.tool_call_id)}
              />
            ) : (
              <>
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
              </>
            )}
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
  toolExpansion,
}: {
  entry: HistoryEntry;
  toolExpansion?: (callId: string) => {
    get: () => boolean | undefined;
    set: (value: boolean) => void;
  };
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
              toolExpansion={toolExpansion}
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
              toolExpansion={toolExpansion}
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
          initiallyExpanded={false}
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
      {entry.kind === "unknown" ? (
        entry.entry_type || entry.blocks?.length ? (
          <aside
            className={entry.entry_type ? "ah-pi-marker" : "ah-pi-extension"}
            role="note"
          >
            <span>
              {(
                {
                  compaction: "Keskustelu tiivistettiin",
                  branch_summary: "Haaran tiivistelmä",
                  label: "Merkintä",
                } as Record<string, string>
              )[entry.entry_type ?? ""] ??
                (entry.entry_type ? "Pi-merkintä" : "Laajennuksen viesti")}
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
export function SessionSettingsRow({ marker }: { marker: SessionMarker }) {
  return (
    <aside
      className="ah-session-settings"
      role="note"
      aria-label="Keskustelun asetukset"
    >
      {marker.compact !== undefined ? (
        <span>Tiivistys · {marker.compact}</span>
      ) : null}
      {marker.model !== undefined ? (
        <span>
          Malli ·{" "}
          {marker.oldModel ? (
            <>
              <code>{marker.oldModel}</code> →{" "}
            </>
          ) : null}
          <code>{marker.model}</code>
          <ControlButton
            variant="quiet"
            size="micro"
            aria-label="Kopioi mallin tunniste"
            title="Kopioi mallin tunniste"
            onPress={() =>
              void navigator.clipboard?.writeText(marker.model ?? "")
            }
          >
            ⧉
          </ControlButton>
        </span>
      ) : null}
      {marker.thinking !== undefined ? (
        <span>
          Ajattelu · {marker.oldThinking ? `${marker.oldThinking} → ` : ""}
          {marker.thinking}
        </span>
      ) : null}
    </aside>
  );
}

export function timelineItems(
  entries: HistoryEntry[],
  onLogin?: () => void,
  agentId?: string,
  revision?: string,
  liveTools?: Map<string, LiveTool>,
  toolExpansion?: (callId: string) => {
    get: () => boolean | undefined;
    set: (value: boolean) => void;
  },
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
  const markers = sessionMarkers(entries);
  const visible = entries.filter(
    (entry) =>
      !hiddenSessionEntry(entry, markers) &&
      (!entry.tool_call_id || results.get(entry.tool_call_id) !== entry),
  );
  const items: { id: string; kind: string; content: React.ReactNode }[] = [];
  let turn: HistoryEntry[] = [];
  const flush = () => {
    if (!turn.length) return;
    const group = turn;
    turn = [];
    const work = group.flatMap((entry) => entry.blocks ?? []);
    const final = group.findLast(
      (entry) =>
        entry.blocks?.some((b) => b.type === "text") ||
        (entry.content.text && !entry.blocks?.length),
    );
    items.push({
      id: group[0].entry_key,
      kind: "assistant",
      content: (
        <AgentTurn
          model={final?.model ?? group.findLast((e) => e.model)?.model}
          thinkingCount={work.filter((b) => b.type === "thinking").length}
          toolCount={work.filter((b) => b.type === "toolCall").length}
          work={group.map((entry) => (
            <OrderedBlocks
              key={entry.entry_key}
              blocks={
                entry === final
                  ? (entry.blocks ?? []).slice(0, -1)
                  : (entry.blocks ?? [])
              }
              entryKey={entry.entry_key}
              results={results}
              liveTools={liveTools}
              toolExpansion={toolExpansion}
              agentId={agentId}
              revision={entry.native_revision ?? revision}
              onLogin={onLogin}
            />
          ))}
          reply={
            final ? (
              <AssistantMessage
                streamState="complete"
                modelLabel={
                  final.model ?? group.findLast((entry) => entry.model)?.model
                }
                onCopy={() =>
                  void navigator.clipboard?.writeText(final.content.text)
                }
              >
                <OrderedBlocks
                  blocks={
                    final.blocks?.length
                      ? final.blocks.slice(-1)
                      : [{ type: "text", text: final.content.text }]
                  }
                  entryKey={final.entry_key}
                  toolExpansion={toolExpansion}
                  agentId={agentId}
                  revision={final.native_revision ?? revision}
                  onLogin={onLogin}
                />
              </AssistantMessage>
            ) : undefined
          }
        />
      ),
    });
  };
  for (const entry of visible) {
    const marker = markers.get(entry.entry_key);
    if (marker) {
      flush();
      items.push({
        id: entry.entry_key,
        kind: "marker",
        content: <SessionSettingsRow marker={marker} />,
      });
      continue;
    }
    if (entry.kind === "assistant") {
      // A native assistant entry may contain tool calls before the final text.
      if (
        turn.length &&
        (turn.at(-1)?.blocks?.at(-1)?.type === "text" ||
          (!turn.at(-1)?.blocks?.length && !!turn.at(-1)?.content.text))
      )
        flush();
      turn.push(entry);
    } else {
      if (
        entry.kind === "user" ||
        entry.kind === "bash" ||
        entry.kind === "unknown"
      )
        flush();
      if (
        entry.kind !== "tool" ||
        !entry.tool_call_id ||
        !calls.has(entry.tool_call_id)
      )
        items.push({
          id: entry.entry_key,
          kind: entry.kind,
          content: (
            <Entry
              key={entry.entry_key}
              entry={entry}
              results={results}
              liveTools={liveTools}
              toolExpansion={toolExpansion}
              onLogin={onLogin}
              agentId={agentId}
              revision={revision}
            />
          ),
        });
    }
  }
  flush();
  return items;
}
export function HistoryView({
  agent,
  workspaceName,
  workspaceId,
  onLogin,
  store,
  onRestore,
  onArchive,
  onTitleComplete,
  csrf,
  restoreAvailable = false,
  archiveBusy = false,
}: {
  agent: Agent;
  workspaceName: string;
  workspaceId: string;
  onLogin: () => void;
  store: ConversationStore;
  onRestore?: () => void;
  onArchive?: () => void;
  onTitleComplete?: () => void;
  csrf?: string;
  restoreAvailable?: boolean;
  archiveBusy?: boolean;
}) {
  const window = useWindow(store, agent.agent_id);
  const navigate = useNavigate();
  const [eligibility, setEligibility] =
    useState<Awaited<ReturnType<typeof historyEligibility>>>();
  const [actionError, setActionError] = useState("");
  const [continuing, setContinuing] = useState(false);
  useEffect(() => {
    let controller = new AbortController();
    const probe = () => {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      if (agent.history === "readable")
        void historyEligibility(agent.agent_id, signal)
          .then((answer) => {
            if (!signal.aborted) setEligibility(answer);
          })
          .catch((error) => {
            if (!signal.aborted) {
              setEligibility(undefined);
              if ((error as Error).message === "identity_lost") onLogin();
            }
          });
    };
    setEligibility(undefined);
    probe();
    const timer = globalThis.setInterval(probe, 5000);
    return () => {
      globalThis.clearInterval(timer);
      controller.abort();
    };
  }, [agent.agent_id, agent.history, onLogin]);
  // A snapshot is not a fresh write precondition. Keep actions blocked until
  // this opening's own census has returned a positive answer.
  const process =
    eligibility?.continuation === "writer_present"
      ? "writer_present"
      : (eligibility?.process ?? "unknown");
  const mayWrite =
    process === "not_observed" && !!csrf && agent.history === "readable";
  const blockedReason =
    process === "writer_present"
      ? "Kirjoittaja on käynnissä."
      : "Prosessin tilaa ei voitu vahvistaa.";
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
  const [recap, setRecap] = useState<Awaited<
    ReturnType<typeof readRecap>
  > | null>(null);
  const [recapDismissed, setRecapDismissed] = useState(false);
  useEffect(() => {
    let active = true;
    setRecap(null);
    setRecapDismissed(false);
    if (agent.history === "readable")
      void readRecap(agent.agent_id)
        .then((value) => {
          if (active) setRecap(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [agent.agent_id, agent.history]);
  const entries = window?.entries ?? [];
  const settings = latestSettings(entries);
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
    const index = rowIndexOf(entries, saved.key);
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
        activityLabel={
          process === "not_observed"
            ? "Ei käynnissä"
            : process === "writer_present"
              ? "Käynnissä"
              : "Prosessin tila ei tiedossa"
        }
        activityKind={
          process === "not_observed"
            ? "neutral"
            : process === "writer_present"
              ? "working"
              : "unknown"
        }
        controlKind="read-only"
        controlLabel="Vain luku"
        settings={settings}
        detailsFacts={[
          { label: "Työtila", value: workspaceName },
          {
            label: "Malli",
            value: settings.model ?? "Ei tiedossa",
            copy: !!settings.model,
          },
          { label: "Ajattelutaso", value: settings.thinking ?? "Ei tiedossa" },
          { label: "Ohjaus", value: "Vain luku" },
          { label: "Aloitettu", value: "Ei tiedossa" },
          { label: "Natiivi tunniste", value: agent.agent_id, copy: true },
        ]}
        titleAction={{
          label: "Luo uusi otsikko",
          availability:
            mayWrite && entries.length > 0
              ? { state: "enabled" }
              : {
                  state: "disabled",
                  reason:
                    entries.length === 0
                      ? "Keskustelussa ei ole vielä nimettävää sisältöä."
                      : blockedReason,
                },
          onPress: () => {
            if (!mayWrite || !csrf || entries.length === 0 || busy) return;
            setBusy(true);
            setActionError("");
            void retitleHistory(agent.agent_id, workspaceId, csrf)
              .then(() => onTitleComplete?.())
              .catch((error) => {
                if ((error as Error).message === "identity_lost") onLogin();
                else
                  setActionError(
                    "Otsikkoa ei voitu luoda. Tarkista tila ennen uutta yritystä.",
                  );
              })
              .finally(() => setBusy(false));
          },
        }}
        archiveReason={
          agent.archive === "archived" || mayWrite ? undefined : blockedReason
        }
        archiveControl={
          <ArchiveControls
            state={agent.archive ?? "unknown"}
            empty={
              state === "empty" || (state === "ready" && entries.length === 0)
            }
            eligible={
              agent.archive === "archived"
                ? restoreAvailable
                : mayWrite && !archiveBusy
            }
            busy={archiveBusy}
            blockedReason={
              agent.archive === "archived"
                ? !restoreAvailable
                  ? "Palautus ei ole käytettävissä ennen historian ja yhteyden vahvistusta."
                  : undefined
                : mayWrite
                  ? undefined
                  : blockedReason
            }
            onArchive={() => {
              if (mayWrite) onArchive?.();
            }}
            onRestore={() => onRestore?.()}
          />
        }
        workspaceLabel={workspaceName}
        workspaceHref={`/workspaces/${workspaceId}`}
        detailsExpanded={details}
        onToggleDetails={() => setDetails(!details)}
      />
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
      {actionError && <InlineNotice title={actionError} tone="warning" />}
      {!recapDismissed && recap?.latest_message ? (
        <RecapCard
          recap={recap.recap}
          now={Date.now()}
          stale={!!recap.recap && recap.recap.through !== recap.latest_message}
          pending={false}
          error={false}
          unavailable
          unavailableReason="Katsauksen luominen vaatii keskustelun jatkamista."
          onDismiss={() => setRecapDismissed(true)}
        />
      ) : null}
      <div className="ah-read-only-footer">
        <div>
          <strong>Vain luku</strong>
          <p>
            {eligibility?.continuation === "writer_present"
              ? "Jatkaminen estetty: keskustelulla on aktiivinen kirjoittaja."
              : eligibility?.continuation === "unproven"
                ? "Jatkamisen edellytyksiä ei voitu vahvistaa. Päivitä tiedot."
                : "Tätä keskustelua ei voi ohjata selaimesta."}
          </p>
        </div>
        {eligibility?.continuation === "eligible" &&
        mayWrite &&
        agent.archive !== "archived" ? (
          <Button
            label={continuing ? "Jatketaan…" : "Jatka keskustelua"}
            pending={continuing}
            onPress={() => {
              if (!csrf || continuing) return;
              setContinuing(true);
              setActionError("");
              void continueConversation(agent.agent_id, workspaceId, csrf)
                .then(() =>
                  navigate(
                    `/workspaces/${workspaceId}?conversation=${agent.agent_id}`,
                  ),
                )
                .catch((error) => {
                  if ((error as Error).message === "identity_lost") onLogin();
                  else
                    setActionError(
                      "Jatkaminen ei onnistunut. Tarkista keskustelun tila ennen uutta yritystä.",
                    );
                  setEligibility(undefined);
                })
                .finally(() => setContinuing(false));
            }}
          />
        ) : (
          <LinkRow href={`/workspaces/${workspaceId}`} kind="inline">
            Uusi keskustelu
          </LinkRow>
        )}
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
