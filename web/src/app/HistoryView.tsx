import {
  useCallback,
  useContext,
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
import { AgentTurn, ThinkingRow, type TurnStep } from "../components/AgentTurn";
import { archiveAction } from "../components/ArchiveControls";
import { attachmentsIn, messageText } from "../components/AttachmentChips";
import { BackgroundStrip } from "../components/BackgroundStrip";
import { BashToolCard } from "../components/BashToolCard";
import { ControlButton, LinkRow } from "../components/ControlElements";
import { ArchivedFoot } from "../components/ConversationArchive";
import { CommandRun } from "../components/composer/CommandRun";
import { FileToolCard, fileStat } from "../components/FileToolCard";
import { Icon } from "../components/Icon";
import { OutputBox } from "../components/OutputBox";
import { PiBoundary, PiToolUse } from "../components/PiBlocks";
import {
  ProcessAwareToolUse,
  ProcessCompletion,
  ProcessProvider,
  ProcessStartCard,
} from "../components/ProcessTray";
import { RecapCard, useMinuteNow } from "../components/RecapCard";
import { RestartNoticeMarker } from "../components/RestartNotice";
import { SessionSettingsRow } from "../components/SessionSettingsRow";
import { SkillInvocation } from "../components/SkillInvocation";
import { WaitReminderMarker } from "../components/WaitReminder";
import { formatDate, liveText } from "../i18n";
import { historyViewText } from "../text/historyView";
import { largeContentText } from "../text/largeContent";
import { useExperimentalFeature } from "./accountPreferences";
import { agentTitle } from "./agentTitle";
import { refusedTurnLine } from "./aiSignIn";
import { useBrowserShell } from "./BrowserShell";
import { type BashFailure, toolStopped } from "./bashFailure";
import { type ConversationStore, useWindow } from "./conversationStore";
import {
  currentRecap,
  historyEligibility,
  readRecap,
  renameConversation,
  retitleHistory,
  TitleGenerationFailed,
} from "./conversations";
import { ArchivedHelpers, HelperRestoreNote } from "./HelperArchiveFlow";
import {
  type BlockChunk,
  fullTextBlock,
  type HistoryBlock,
  type HistoryEntry,
  readHistory,
} from "./history";
import { collapsedImageBytes, collapsedImageCount } from "./largeContent";
import { startProblemReason } from "./mutations";
import {
  nameRefused,
  namingRefusal,
  titleModelUnavailable,
} from "./namingRefusal";
import { useNewConversationAsk } from "./newConversationAsk";
import { sshTarget } from "./ownMachines";
import { OwnMachineUseProvider, useOpenMachines } from "./ownMachineUse";
import { RewindContext, RewindEntryRow } from "./rewindView";
import { SpinoffProvider } from "./SpinoffConversation";
import { useStoragePressure } from "./StoragePressure";
import {
  hiddenSessionEntry,
  latestSettings,
  sessionMarkers,
} from "./sessionSettings";
import type { Agent } from "./snapshot";
import { TurnChangesRoot, TurnChangesSource } from "./TurnChangesSource";
import {
  rowIndexOf,
  scrollToEnd,
  visibleEntryKeys,
} from "./useReadingPosition";
import { NoticeEntry, useAssetsControl } from "./ViewHost";
import { EditorHeaderControls } from "./WorkspaceEditor";

const txt = liveText(historyViewText);
const sizes = liveText(largeContentText);

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
  plainText = false,
  hasImage = false,
  part,
}: {
  hasImage?: boolean;
  part?: "skill_arguments";
  plainText?: boolean | "user" | "command";
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
  // Loaded content belongs to one native block. A turn's text keeps this
  // element when its streamed reply becomes the saved one (TurnText).
  const source = `${entryKey}:${revision}:${index}:${part ?? ""}`;
  const [loadedFor, setLoadedFor] = useState(source);
  const current = useRef(source);
  current.current = source;
  if (loadedFor !== source) {
    setLoadedFor(source);
    setLoaded(undefined);
    setPending(false);
    setFailed(false);
  }
  const displayedText = loaded?.text ?? block.text ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: a read for the previous source must not land in this one.
  useEffect(() => () => request.current?.abort(), [source]);
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
        const response = await fetch(part ? `${url}&part=${part}` : url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const value = await readHistory(response);
        if (!("chunk" in value)) throw new Error("invalid block");
        const chunk = value as BlockChunk;
        if (
          chunk.part !== part ||
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
        if (controller.signal.aborted || current.current !== source) return;
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
        data-testid="history-block-load"
        size="row"
        label={
          pending ? txt.loading : loaded ? txt.loadMoreBlock : txt.loadBlock
        }
        pending={pending}
        onPress={more}
      />
    ) : null;
  const warning = failed ? (
    <InlineNotice
      title={txt.blockFailed}
      description={txt.blockFailedDetail}
      tone="warning"
    />
  ) : null;
  switch (block.type) {
    case "process_event":
      return block.process_event ? (
        <ProcessCompletion event={block.process_event} />
      ) : (
        <PiBoundary>{txt.processEntryMissing}</PiBoundary>
      );
    case "text": {
      const text = displayedText;
      const whole = loaded?.complete || !block.readable;
      return (
        <div className={toolName ? "ah-pi-result" : undefined}>
          {toolName ? (
            <fieldset className="ah-pi-edge">
              <legend>{txt.previewEdge(toolName)}</legend>
              {(["head", "tail"] as const).map((option) => (
                <ControlButton
                  variant="quiet"
                  size="row"
                  key={option}
                  aria-pressed={edge === option}
                  onPress={() => {
                    resultEdge.set(toolName, option);
                    setEdge(option);
                  }}
                >
                  {option === "head" ? txt.head : txt.tail}
                </ControlButton>
              ))}
            </fieldset>
          ) : null}
          {plainText === "user" && !toolName ? (
            // The message's attachments show as chips below it.
            <Markdown text={messageText(text, hasImage && whole)} breaks />
          ) : plainText === "command" ? (
            <OutputBox text={text} complete={whole} />
          ) : toolName || plainText ? (
            <pre ref={preview}>{text}</pre>
          ) : (
            <Markdown text={text} />
          )}
          {toolName && edge === "tail" && !whole ? (
            <PiBoundary>{txt.tailMissing}</PiBoundary>
          ) : null}
          {block.readable && !loaded?.complete ? (
            <PiBoundary>{txt.previewEnds}</PiBoundary>
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
          <p>{txt.image(block.mime_type || txt.unknownFormat)}</p>
          {loaded?.complete &&
          loaded.data &&
          ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
            loaded.mediaType,
          ) ? (
            <img
              className="ah-history-image"
              alt={txt.imageAlt}
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
          <summary>{txt.toolArguments(block.tool_name || txt.tool)}</summary>
          {loaded?.text ? <pre>{loaded.text}</pre> : null}
          {control}
          {warning}
        </details>
      );
    default:
      return <p>{txt.unknownBlock}</p>;
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
  failureCause,
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
  failureCause?: BashFailure;
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
        failureCause={failureCause}
        output={output}
        running={running}
      />
      {error ? <PiBoundary>{txt.commandFailed}</PiBoundary> : null}
      {partial ? <PiBoundary>{txt.commandPreviewEnds}</PiBoundary> : null}
    </>
  );
}
function FileUse({
  block,
  index,
  entryKey,
  agentId,
  revision,
  onLogin,
  result,
  live,
  expansion,
}: {
  block: HistoryBlock;
  index: number;
  entryKey: string;
  agentId?: string;
  revision?: string;
  onLogin?: () => void;
  result?: HistoryEntry;
  live?: LiveTool;
  expansion?: { get: () => boolean | undefined; set: (value: boolean) => void };
}) {
  const [argumentsText, setArgumentsText] = useState(block.text ?? "");
  const [error, setError] = useState(false);
  const [fullOutput, setFullOutput] = useState<string>();
  useEffect(() => {
    if (!block.readable || !agentId || !revision) return;
    const controller = new AbortController();
    void fullTextBlock(agentId, revision, entryKey, index, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setArgumentsText(value);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if ((error as Error).message === "identity_lost") onLogin?.();
        else setError(true);
      });
    return () => controller.abort();
  }, [block.readable, agentId, revision, entryKey, index, onLogin]);
  const resultIndex =
    result?.blocks?.findIndex((b) => b.type === "text" && b.readable) ?? -1;
  const resultKey = result?.entry_key;
  const resultRevision = result?.native_revision ?? revision;
  useEffect(() => {
    if (!agentId || !resultRevision || !resultKey || resultIndex < 0) return;
    const controller = new AbortController();
    void fullTextBlock(
      agentId,
      resultRevision,
      resultKey,
      resultIndex,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setFullOutput(value);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if ((error as Error).message === "identity_lost") onLogin?.();
        else setError(true);
      });
    return () => controller.abort();
  }, [agentId, resultRevision, resultKey, resultIndex, onLogin]);
  const output =
    fullOutput ??
    result?.blocks
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n") ??
    live?.output;
  return (
    <PiToolUse
      name={block.tool_name ?? txt.tool}
      targetText={(() => {
        try {
          const a: unknown = JSON.parse(argumentsText);
          return a &&
            typeof a === "object" &&
            "path" in a &&
            typeof a.path === "string"
            ? a.path
            : undefined;
        } catch {
          return undefined;
        }
      })()}
      stat={fileStat(
        block.tool_name ?? "",
        argumentsText,
        output,
        !!result?.is_error || live?.state === "failed",
      )}
      state={
        result?.is_error
          ? "failed"
          : result
            ? "succeeded"
            : toolState(live?.state)
      }
      expansion={expansion}
    >
      <FileToolCard
        name={block.tool_name ?? ""}
        argumentsText={argumentsText}
        output={output}
        failed={!!result?.is_error || live?.state === "failed"}
      />
      {error ? <PiBoundary>{txt.fileFailed}</PiBoundary> : null}
    </PiToolUse>
  );
}
/**
 * A reply's text in a turn. The streamed and the saved reply render through
 * this same element, so a turn that settles keeps its DOM and any selection
 * in it, also when the saved reply is only a preview of a long one.
 */
export function TurnText(props: Parameters<typeof ReadableBlock>[0]) {
  return (
    <div className="ah-ordered-blocks" data-reply-entry={props.entryKey}>
      <ReadableBlock {...props} />
    </div>
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
  plainText = false,
  firstIndex = 0,
  attachedImages = false,
}: {
  plainText?: boolean | "user";
  /** The message's image attachments show as chips, so its image blocks are skipped. */
  attachedImages?: boolean;
  blocks: HistoryBlock[];
  /** The native index of the first block when these are a slice of an entry. */
  firstIndex?: number;
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
  // Many large pictures in one entry show as one folded row until opened, so
  // the rest of the history reads past them (twenty screenshots are tens of
  // megabytes). A person's own attachments show as thumbnails instead.
  const [picturesOpen, setPicturesOpen] = useState(false);
  const pictures = attachedImages
    ? []
    : blocks.filter((block) => block.type === "image");
  const pictureBytes = pictures.reduce((sum, b) => sum + (b.bytes ?? 0), 0);
  const firstPicture = blocks.findIndex((block) => block.type === "image");
  const folded =
    !picturesOpen &&
    pictures.length >= collapsedImageCount &&
    pictureBytes >= collapsedImageBytes;
  const onCommand = useCallback(
    (id: string, text: string) =>
      setCommands((previous) =>
        previous[id] === text ? previous : { ...previous, [id]: text },
      ),
    [],
  );
  return (
    <div className="ah-ordered-blocks">
      {blocks.map((block, position) => {
        const index = firstIndex + position;
        if (attachedImages && block.type === "image") return null;
        if (folded && block.type === "image")
          return position === firstPicture ? (
            <div
              key={`${entryKey}:${revision}:pictures`}
              data-testid="history-pictures-folded"
              className="ah-collapsed-pictures"
            >
              <Icon name="image" width={16} height={16} aria-hidden="true" />
              <span className="ah-collapsed-pictures-text">
                {txt.picturesCollapsed(
                  pictures.length,
                  sizes.size(pictureBytes),
                )}
                <span className="ah-collapsed-pictures-detail">
                  {txt.picturesCollapsedDetail}
                </span>
              </span>
              <ControlButton
                data-testid="history-pictures-open"
                size="row"
                variant="quiet"
                onPress={() => setPicturesOpen(true)}
              >
                {txt.openPictures}
              </ControlButton>
            </div>
          ) : null;
        return block.type === "toolCall" &&
          block.tool_call_id &&
          ["read", "write", "edit"].includes(block.tool_name ?? "") ? (
          <FileUse
            key={`${entryKey}:${revision}:${block.tool_call_id}`}
            block={block}
            index={index}
            entryKey={entryKey}
            agentId={agentId}
            revision={revision}
            onLogin={onLogin}
            result={results?.get(block.tool_call_id)}
            live={liveTools?.get(block.tool_call_id)}
            expansion={toolExpansion?.(block.tool_call_id)}
          />
        ) : block.type === "toolCall" && block.tool_call_id ? (
          <ProcessAwareToolUse
            argumentsText={block.text}
            result={results
              ?.get(block.tool_call_id)
              ?.blocks?.filter((b) => b.type === "text")
              .map((b) => b.text ?? "")
              .join("\n")}
            key={`${entryKey}:${revision}:${block.tool_call_id}`}
            name={block.tool_name || txt.tool}
            stat={fileStat(
              block.tool_name ?? "",
              block.text ?? "",
              results
                ?.get(block.tool_call_id)
                ?.blocks?.filter((b) => b.type === "text")
                .map((b) => b.text ?? "")
                .join("\n"),
            )}
            failureCause={
              results?.get(block.tool_call_id)?.failure_cause ??
              liveTools?.get(block.tool_call_id)?.failureCause
            }
            keepMounted={block.tool_name === "bash"}
            expansion={toolExpansion?.(block.tool_call_id)}
            targetText={
              block.tool_name === "bash"
                ? (commands[block.tool_call_id] ??
                  (block.text
                    ? bashCommand(block.text).split("\n")[0]
                    : undefined))
                : undefined
            }
            remoteHost={
              block.tool_name === "bash"
                ? sshTarget(
                    commands[block.tool_call_id] ??
                      bashCommand(block.text ?? ""),
                  )
                : undefined
            }
            state={toolOutcome(
              results?.get(block.tool_call_id),
              liveTools?.get(block.tool_call_id),
            )}
          >
            {block.tool_name === "process" ? (
              <ProcessStartCard
                argumentsText={block.text ?? ""}
                result={
                  results
                    ?.get(block.tool_call_id)
                    ?.blocks?.filter((b) => b.type === "text")
                    .map((b) => b.text ?? "")
                    .join("\n") ?? liveTools?.get(block.tool_call_id)?.output
                }
              />
            ) : block.tool_name === "bash" ? (
              <BashCall
                failureCause={
                  results?.get(block.tool_call_id)?.failure_cause ??
                  liveTools?.get(block.tool_call_id)?.failureCause
                }
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
                  plainText={plainText}
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
                    <strong>{txt.latestUpdate}</strong>
                    <pre>{liveTools.get(block.tool_call_id)?.output}</pre>
                  </>
                ) : null}
                {results?.get(block.tool_call_id) ? (
                  <>
                    <strong>{txt.result}</strong>
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
          </ProcessAwareToolUse>
        ) : (
          <ReadableBlock
            plainText={plainText}
            hasImage={attachedImages || blocks.some((b) => b.type === "image")}
            key={`${entryKey}:${revision}:${index}`}
            block={block}
            toolName={toolName}
            index={index}
            entryKey={entryKey}
            agentId={agentId}
            revision={revision}
            onLogin={onLogin}
          />
        );
      })}
    </div>
  );
}

// pi-processes sends XML-shaped plain text, not HTML/Markdown. Select only
// its human summary for the heading; keep the full public content inspectable.
function processSummary(entry: HistoryEntry): string | undefined {
  if (entry.entry_type || entry.blocks?.length !== 1) return;
  const text = entry.blocks[0].text;
  if (
    !text?.startsWith("<process_event ") ||
    !text.trimEnd().endsWith("</process_event>")
  )
    return;
  const summary = /<summary>([\s\S]*?)<\/summary>/.exec(text)?.[1];
  return summary?.replace(
    /&(lt|gt|quot|apos|amp);/g,
    (_, entity: string) =>
      ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[entity] ?? "",
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
  const rewind = useContext(RewindContext);
  if (entry.notice) return <NoticeEntry notice={entry.notice} />;
  if (entry.restart)
    return (
      <RestartNoticeMarker notice={entry.restart} timestamp={entry.timestamp} />
    );
  if (entry.wait_reminder)
    return <WaitReminderMarker reminder={entry.wait_reminder} />;
  const processBlocks = entry.blocks?.filter((b) => b.type === "process_event");
  if (processBlocks?.length)
    return (
      <>
        {processBlocks.map((b, i) =>
          b.process_event ? (
            <ProcessCompletion
              // biome-ignore lint/suspicious/noArrayIndexKey: Native block indexes identify immutable history blocks.
              key={`${entry.entry_key}:${i}`}
              event={b.process_event}
            />
          ) : null,
        )}
      </>
    );
  const content = entry.content;
  // The native wrapper contains private source metadata. Copy a portable
  // invocation instead; this reconstructs intent, not the original command bytes.
  const copy = () =>
    void navigator.clipboard?.writeText(
      entry.skill
        ? `/skill:${entry.skill.name}${content.text ? ` ${content.text}` : ""}`
        : content.text,
    );
  const notificationSummary = processSummary(entry);
  return (
    <>
      {entry.kind === "user" ? (
        <UserMessage
          sourceText={content.text}
          onCopy={copy}
          actions={rewind?.menu(entry)}
          skill={
            entry.skill && entry.blocks?.[0]?.type === "text" ? (
              <SkillInvocation
                name={entry.skill.name}
                description={entry.skill.description}
              >
                <ReadableBlock
                  block={entry.blocks[0]}
                  index={0}
                  entryKey={entry.entry_key}
                  agentId={agentId}
                  revision={entry.native_revision ?? revision}
                  onLogin={onLogin}
                />
              </SkillInvocation>
            ) : undefined
          }
        >
          {entry.skill || entry.blocks?.length ? (
            <>
              {entry.skill ? (
                <ReadableBlock
                  block={{
                    type: "text",
                    text: content.text,
                    readable: !content.complete,
                  }}
                  index={0}
                  part="skill_arguments"
                  plainText="user"
                  entryKey={entry.entry_key}
                  agentId={agentId}
                  revision={entry.native_revision ?? revision}
                  onLogin={onLogin}
                />
              ) : null}
              {entry.blocks?.length ? (
                <OrderedBlocks
                  plainText="user"
                  // The host gives Pi each attached image as an image block
                  // too; the chip already shows it and opens the preview.
                  attachedImages={attachmentsIn(content.text).some(
                    (a) => a.image,
                  )}
                  firstIndex={entry.skill ? 1 : 0}
                  blocks={entry.skill ? entry.blocks.slice(1) : entry.blocks}
                  results={results}
                  liveTools={liveTools}
                  toolExpansion={toolExpansion}
                  entryKey={entry.entry_key}
                  agentId={agentId}
                  revision={entry.native_revision ?? revision}
                  onLogin={onLogin}
                />
              ) : undefined}
            </>
          ) : undefined}
        </UserMessage>
      ) : null}
      {/* Native history omits the stop reason; a saved tool-use message may
          precede the rest of a still-running turn. */}
      {entry.kind === "assistant" ? (
        <AssistantMessage
          onCopy={copy}
          streamState={entry.stop_reason === "error" ? "failed" : undefined}
        >
          {entry.stop_reason === "error" && entry.refused_by ? (
            <p className="ah-turn-short" data-testid="turn-short">
              {refusedTurnLine(entry.refused_by)}
            </p>
          ) : entry.blocks ? (
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
          ) : (
            <Markdown text={content.text} />
          )}
        </AssistantMessage>
      ) : null}
      {entry.kind === "tool" ? (
        <PiToolUse
          name={entry.content.text.split("\n", 1)[0] || txt.tool}
          state={toolOutcome(entry)}
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
        <CommandRun
          label={txt.localCommand}
          source="history"
          command={entry.blocks?.[0]?.text ?? ""}
          excludeFromContext={entry.exclude_from_context ?? false}
          state={
            entry.cancelled
              ? "cancelled"
              : entry.exit_code !== undefined
                ? "finished"
                : "uncertain"
          }
          exitCode={entry.exit_code}
          output=""
        >
          {entry.blocks?.[0]?.readable ? (
            <div className="ah-cmd-output-block">
              <strong>{txt.command}</strong>
              <ReadableBlock
                plainText="command"
                block={entry.blocks[0]}
                index={0}
                entryKey={entry.entry_key}
                agentId={agentId}
                revision={entry.native_revision ?? revision}
                onLogin={onLogin}
              />
            </div>
          ) : null}
          {entry.blocks?.slice(1).map((block, index) => (
            <div
              className="ah-cmd-output-block"
              // biome-ignore lint/suspicious/noArrayIndexKey: Native output block positions are stable within an entry.
              key={`${entry.entry_key}:${index + 1}`}
            >
              <ReadableBlock
                plainText="command"
                block={block}
                index={index + 1}
                entryKey={entry.entry_key}
                agentId={agentId}
                revision={entry.native_revision ?? revision}
                onLogin={onLogin}
              />
            </div>
          ))}
          {!entry.blocks?.slice(1).length ? (
            <OutputBox text={txt.noOutput} />
          ) : null}
          {entry.output_truncated ? (
            <PiBoundary>{txt.outputTruncated}</PiBoundary>
          ) : null}
        </CommandRun>
      ) : null}
      {entry.kind === "unknown" ? (
        entry.entry_type || entry.blocks?.length ? (
          <aside
            className={entry.entry_type ? "ah-pi-marker" : "ah-pi-extension"}
            role="note"
          >
            <span>
              {(txt.markers as Record<string, string>)[
                entry.entry_type ?? ""
              ] ??
                (entry.entry_type
                  ? txt.agentMarker
                  : notificationSummary
                    ? txt.processNotice
                    : txt.extensionMessage)}
            </span>
            {notificationSummary ? <p>{notificationSummary}</p> : null}
            {entry.blocks?.length ? (
              notificationSummary ? (
                <details>
                  <summary>{txt.noticeContent}</summary>
                  <OrderedBlocks
                    plainText
                    blocks={entry.blocks}
                    entryKey={entry.entry_key}
                    agentId={agentId}
                    revision={entry.native_revision ?? revision}
                    onLogin={onLogin}
                  />
                </details>
              ) : (
                <OrderedBlocks
                  plainText={!entry.entry_type}
                  blocks={entry.blocks}
                  entryKey={entry.entry_key}
                  agentId={agentId}
                  revision={entry.native_revision ?? revision}
                  onLogin={onLogin}
                />
              )
            ) : null}
          </aside>
        ) : (
          <UnknownEvent
            kindLabel={txt.agentEvent}
            safeSummary={txt.unsupported(entry.entry_type ?? txt.unknownType)}
            // The host gives an unknown entry no text; copy what is shown.
            onCopy={() =>
              void navigator.clipboard?.writeText(
                txt.unsupported(entry.entry_type ?? txt.unknownType),
              )
            }
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
        toolName={entry.content.text.split("\n", 1)[0] || txt.tool}
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
          <PiBoundary>{txt.previewEndsShort}</PiBoundary>
          <Button
            data-testid="history-output-toggle"
            size="row"
            label={expanded ? txt.collapseOutput : txt.showOutput}
            onPress={() => setExpanded(!expanded)}
          />
        </>
      ) : null}
    </div>
  );
}

/** A saved result decides; before it, the live event does. */
function toolOutcome(result?: HistoryEntry, live?: LiveTool) {
  if (result)
    return result.is_error
      ? toolStopped(result.failure_cause)
        ? "cancelled"
        : "failed"
      : "succeeded";
  const state = toolState(live?.state);
  return state === "failed" && toolStopped(live?.failureCause)
    ? "cancelled"
    : state;
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
  failureCause?: BashFailure;
};

/**
 * The aborted replies a server restart cut rather than the person. Pi saves
 * both alike; the host tells them apart. The catch-up Habitat gave the agent
 * after a restart says whether the turn Pi was working on never finished
 * (interrupted_turn), which then is the aborted reply just before it, and
 * while the conversation still rests the snapshot says the same of its
 * latest reply.
 */
function restartCutReplies(entries: HistoryEntry[], lastCut?: boolean) {
  const cut = new Set<string>();
  let aborted: string | undefined;
  for (const entry of entries) {
    if (entry.kind === "assistant")
      aborted = entry.stop_reason === "aborted" ? entry.entry_key : undefined;
    else if (entry.restart) {
      if (
        aborted &&
        entry.restart.interrupted_turn &&
        entry.restart.stopped?.cause === "restart"
      )
        cut.add(aborted);
      aborted = undefined;
    }
  }
  if (lastCut && aborted) cut.add(aborted);
  return cut;
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
  live?: LiveTurnInput,
  /** Palaa tähän's chosen message: it and what follows dim while the
   * sheet is open. */
  dimFrom?: string,
  /** The host says the conversation rests after a server restart cut its
   * latest turn (snapshot rest cause restart with interrupted_turn). */
  restartCut?: boolean,
) {
  const cutByRestart = restartCutReplies(entries, restartCut);
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
  const items: {
    id: string;
    kind: string;
    content: React.ReactNode;
    /** This turn carries the live part of the running turn. */
    live?: boolean;
  }[] = [];
  let turn: HistoryEntry[] = [];
  // A turn is named after the person's message that started it, so the
  // running turn keeps its identity when its first saved entry arrives.
  let turnId: string | undefined;
  let turnStart: number | undefined;
  const steps = (entry: HistoryEntry): TurnStep[] => {
    const blocks: HistoryBlock[] = entry.blocks?.length
      ? entry.blocks
      : entry.content.text
        ? [{ type: "text", text: entry.content.text }]
        : [];
    const revisionOf = entry.native_revision ?? revision;
    const at = savedAt(entry);
    const node = (block: HistoryBlock, index: number) => (
      <OrderedBlocks
        blocks={[block]}
        firstIndex={index}
        entryKey={entry.entry_key}
        results={results}
        liveTools={liveTools}
        toolExpansion={toolExpansion}
        agentId={agentId}
        revision={revisionOf}
        onLogin={onLogin}
      />
    );
    return blocks.map((block, index): TurnStep => {
      const key = `${entry.entry_key}:${index}`;
      if (block.type === "text")
        return {
          kind: "text",
          key,
          text: block.text ?? "",
          at,
          node: (
            <TurnText
              block={block}
              index={index}
              entryKey={entry.entry_key}
              agentId={agentId}
              revision={revisionOf}
              onLogin={onLogin}
            />
          ),
        };
      if (block.type === "thinking")
        return { kind: "thinking", key, at, node: node(block, index) };
      if (block.type === "toolCall")
        return {
          kind: "tool",
          key,
          at,
          failed:
            !!block.tool_call_id &&
            toolOutcome(
              results.get(block.tool_call_id),
              liveTools?.get(block.tool_call_id),
            ) === "failed",
          node: node(block, index),
        };
      return { kind: "other", key, at, node: node(block, index) };
    });
  };
  const endsTurn = (entry: HistoryEntry | undefined) =>
    entry?.blocks?.at(-1)?.type === "text" ||
    (!!entry && !entry.blocks?.length && !!entry.content.text);
  const flush = (last = false) => {
    if (!turn.length) return;
    const group = turn;
    turn = [];
    const id = turnId ?? group[0].entry_key;
    const startedAt = turnStart;
    turnId = turnStart = undefined;
    // The saved part of the running turn and its live tail are one turn.
    const merged =
      last &&
      !!live &&
      group.at(-1)?.stop_reason !== "error" &&
      !endsTurn(group.at(-1));
    // A refused sign-in is one short row: the warning above the field says
    // the rest, and the provider's own words stay in native history.
    const refusedBy =
      group.at(-1)?.stop_reason === "error"
        ? group.at(-1)?.refused_by
        : undefined;
    items.push({
      id,
      kind: "assistant",
      live: merged || undefined,
      content: (
        <AgentTurn
          startedAt={startedAt}
          failed={group.at(-1)?.stop_reason === "error"}
          failure={refusedBy ? refusedTurnLine(refusedBy) : undefined}
          stopped={
            group.at(-1)?.stop_reason === "aborted"
              ? {
                  at: savedAt(group[group.length - 1]),
                  by: cutByRestart.has(group[group.length - 1].entry_key)
                    ? "restart"
                    : undefined,
                }
              : undefined
          }
          steps={[
            ...(refusedBy ? group.slice(0, -1) : group).flatMap(steps),
            ...(merged && live ? live.steps : []),
          ]}
          working={merged && live?.working}
          activity={merged ? live?.activity : undefined}
          duration={merged ? live?.duration : undefined}
          changes={
            <TurnChangesSource
              entries={group}
              results={results}
              agentId={agentId}
              revision={revision}
              startedAt={startedAt}
            />
          }
        />
      ),
    });
  };
  for (const entry of visible) {
    if (entry.kind === "rewind") {
      flush();
      items.push({
        id: entry.entry_key,
        kind: "rewind",
        content: <RewindEntryRow entry={entry} entries={entries} />,
      });
      continue;
    }
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
      if (turn.length && endsTurn(turn.at(-1))) flush();
      turn.push(entry);
    } else {
      if (
        entry.kind === "user" ||
        entry.kind === "bash" ||
        entry.kind === "unknown"
      )
        flush();
      if (entry.kind === "user") {
        turnId = `turn:${entry.entry_key}`;
        turnStart = savedAt(entry);
      }
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
  if (turn.length) flush(true);
  else if (live && items.at(-1)?.kind === "user" && turnId)
    // Pi has saved the person's message but nothing of its answer yet.
    items.push({
      id: turnId,
      kind: "assistant",
      live: true,
      content: (
        <AgentTurn
          steps={live.steps}
          working={live.working}
          activity={live.activity}
          duration={live.duration}
        />
      ),
    });
  const from = dimFrom ? items.findIndex((i) => i.id === dimFrom) : -1;
  if (from >= 0)
    for (let i = from; i < items.length; i++)
      items[i] = {
        ...items[i],
        content: (
          <div
            className="ah-rewind-left"
            data-rewind-target={i === from || undefined}
          >
            {items[i].content}
          </div>
        ),
      };
  return items;
}

/** When Pi saved a native entry; history without a timestamp has no time. */
function savedAt(entry: HistoryEntry): number | undefined {
  const at = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
  return Number.isFinite(at) ? at : undefined;
}

/** The running turn's unsaved tail, shown as the end of its turn. */
export type LiveTurnInput = {
  working: boolean;
  activity?: string;
  duration?: string;
  steps: TurnStep[];
};
const noProcessEvents = () => () => {};
export function HistoryView(props: Parameters<typeof HistoryViewContent>[0]) {
  return (
    <SpinoffProvider
      key={`${props.store.identity}:${props.agent.agent_id}`}
      parent={props.agent.agent_id}
      recheck={props.agent.history}
      onLogin={props.onLogin}
      timeline={timelineItems}
      place={{
        parentTitle: agentTitle(props.agent.title),
        workspaceId: props.workspaceId,
        workspaceName: props.workspaceName,
        csrf: props.csrf,
      }}
    >
      <ProcessProvider
        key={props.agent.agent_id}
        id={props.agent.agent_id}
        csrf={props.csrf}
        onLogin={props.onLogin}
        onStatusEvent={noProcessEvents}
      >
        <OwnMachineUseProvider
          key={`${props.store.identity}:${props.agent.agent_id}`}
        >
          <HistoryViewContent {...props} />
        </OwnMachineUseProvider>
      </ProcessProvider>
    </SpinoffProvider>
  );
}
function HistoryViewContent({
  agent,
  workspaceName,
  workspacePath,
  workspaceId,
  onLogin,
  store,
  onRestore,
  onArchive,
  onTitleComplete,
  onRename,
  csrf,
  restoreAvailable = false,
  archiveBusy = false,
}: {
  agent: Agent;
  workspaceName: string;
  workspacePath?: string;
  workspaceId: string;
  onLogin: () => void;
  store: ConversationStore;
  onRestore?: () => void;
  onArchive?: () => void;
  onTitleComplete?: () => void;
  onRename?: (id: string, name: string) => Promise<void>;
  csrf?: string;
  restoreAvailable?: boolean;
  archiveBusy?: boolean;
}) {
  const openMachines = useOpenMachines();
  const helpersOn = useExperimentalFeature("named-workers");
  const window = useWindow(store, agent.agent_id);
  const storagePressure = useStoragePressure();
  useEffect(() => {
    if (storagePressure.check) void store.reconnect(agent.agent_id);
  }, [storagePressure.check, store, agent.agent_id]);

  // The workspace's shells; this view has no composer to send a selection to.
  const shell = useBrowserShell({
    workspaceId,
    workspaceLabel: workspaceName,
    csrf,
    onLogin,
  });
  const [eligibility, setEligibility] =
    useState<Awaited<ReturnType<typeof historyEligibility>>>();
  // The browser cannot write here: a worker's request starts a new one.
  const workerAsk = useNewConversationAsk({
    identity: store.identity,
    parentId: agent.agent_id,
    workspaceId,
    parentTitle: agentTitle(agent.title),
    csrf,
    onLogin,
  });
  const assets = useAssetsControl(agent.agent_id);
  const [actionError, setActionError] = useState("");
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
    process === "writer_present" ? txt.writerRunning : txt.processUnconfirmed;
  const [busy, setBusy] = useState(false);
  const [titlePending, setTitlePending] = useState(false);
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
  const recapNow = useMinuteNow();
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
  // Nothing here regenerates a terminal history's recap, and an outdated one
  // is not the current situation.
  const shownRecap = recap
    ? currentRecap(recap.recap, recap.latest_message)
    : null;
  const entries = window?.entries ?? [];
  const settings = latestSettings(entries);
  const stream = useRef<HTMLElement>(null);
  const anchor = useRef<{ key: string; offset: number } | undefined>(undefined);
  const following = useRef(true);
  const selectedHistory = useRef(agent.agent_id);
  useLayoutEffect(() => {
    if (selectedHistory.current !== agent.agent_id) {
      selectedHistory.current = agent.agent_id;
      anchor.current = undefined;
      following.current = true;
    }
  }, [agent.agent_id]);
  const capture = (paging = false) => {
    const viewport = stream.current;
    if (!viewport) return;
    if (
      !paging &&
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 2
    ) {
      following.current = true;
      anchor.current = undefined;
      return;
    }
    if (!paging && following.current) return;
    following.current = false;
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: route changes also reset layout when a cached window is reused.
  useLayoutEffect(() => {
    const viewport = stream.current;
    const saved = anchor.current;
    if (!viewport) return;
    if (!saved) {
      scrollToEnd(viewport);
      return;
    }
    const index = rowIndexOf(entries, saved.key);
    const row = viewport.querySelectorAll<HTMLElement>(".ah-feed > li")[index];
    const shift = row
      ? row.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        saved.offset
      : 0;
    if (Math.abs(shift) >= 1) viewport.scrollTop += shift;
  }, [entries, agent.agent_id]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: observe the timeline children mounted by this history window.
  useEffect(() => {
    const viewport = stream.current;
    if (!viewport) return;
    const readerInput = () => {
      following.current = false;
    };
    const readerKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        readerInput();
    };
    const update = () => {
      if (following.current) scrollToEnd(viewport);
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    for (const child of viewport.children) observer.observe(child);
    viewport.addEventListener("wheel", readerInput, { passive: true });
    viewport.addEventListener("touchmove", readerInput, { passive: true });
    viewport.addEventListener("pointerdown", readerInput);
    viewport.addEventListener("keydown", readerKey);
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", readerInput);
      viewport.removeEventListener("touchmove", readerInput);
      viewport.removeEventListener("pointerdown", readerInput);
      viewport.removeEventListener("keydown", readerKey);
    };
  }, [entries, agent.agent_id]);
  const state =
    agent.history !== "readable" ? "error" : (window?.state ?? "loading");
  const loadMore = async () => {
    if (!window?.next || busy) return;
    capture(true);
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
        openMachines={openMachines}
        terminal={shell.toggle}
        editorControl={<EditorHeaderControls />}
        title={agentTitle(agent.title)}
        titlePending={
          titlePending || agent.title.generation_state === "pending"
        }
        activityLabel={
          process === "not_observed"
            ? txt.notRunning
            : process === "writer_present"
              ? txt.running
              : txt.processUnknown
        }
        activityKind={
          process === "not_observed"
            ? "neutral"
            : process === "writer_present"
              ? "working"
              : "unknown"
        }
        controlKind="read-only"
        controlLabel={txt.readOnly}
        settings={settings}
        detailsFacts={[
          {
            label: txt.workspace,
            value: workspacePath ?? txt.unknown,
            copy: !!workspacePath,
          },
          {
            label: txt.model,
            value: settings.model ?? txt.unknown,
            copy: !!settings.model,
          },
          { label: txt.thinking, value: settings.thinking ?? txt.unknown },
          { label: txt.control, value: txt.readOnly },
          {
            label: txt.started,
            value: agent.started_at
              ? formatDate(new Date(agent.started_at), {
                  dateStyle: "short",
                  timeStyle: "medium",
                })
              : txt.unknown,
          },
          { label: txt.nativeId, value: agent.agent_id, copy: true },
        ]}
        rename={
          csrf
            ? {
                availability: mayWrite
                  ? { state: "enabled" }
                  : { state: "disabled", reason: blockedReason },
                onSave: async (name) => {
                  try {
                    if (onRename) await onRename(agent.agent_id, name);
                    else
                      await renameConversation(
                        agent.agent_id,
                        agent.worktree_id ?? workspaceId,
                        name,
                        csrf,
                      );
                  } catch (error) {
                    if ((error as Error).message === "identity_lost") onLogin();
                    throw nameRefused(error);
                  }
                  if (!onRename) onTitleComplete?.();
                },
              }
            : undefined
        }
        titleAction={{
          label: txt.retitle,
          availability:
            mayWrite && entries.length > 0
              ? { state: "enabled" }
              : {
                  state: "disabled",
                  reason:
                    entries.length === 0 ? txt.nothingToName : blockedReason,
                },
          onPress: () => {
            if (!mayWrite || !csrf || entries.length === 0 || busy) return;
            setBusy(true);
            setTitlePending(true);
            setActionError("");
            // A conversation in a worktree is named under its place.
            void retitleHistory(
              agent.agent_id,
              agent.worktree_id ?? workspaceId,
              csrf,
            )
              .then(() => onTitleComplete?.())
              .catch((error) => {
                if ((error as Error).message === "identity_lost") onLogin();
                else
                  setActionError(
                    namingRefusal(error) ??
                      (error instanceof TitleGenerationFailed &&
                      error.reason === "model_unavailable"
                        ? titleModelUnavailable()
                        : txt.retitleFailed),
                  );
              })
              .finally(() => {
                setBusy(false);
                setTitlePending(false);
              });
          },
        }}
        archiveReason={
          agent.archive === "archived" || mayWrite ? undefined : blockedReason
        }
        archive={{
          state: agent.archive ?? "unknown",
          processState: process,
          empty:
            state === "empty" || (state === "ready" && entries.length === 0),
          eligible:
            agent.archive === "archived"
              ? restoreAvailable
              : mayWrite && !archiveBusy,
          busy: archiveBusy,
          blockedReason:
            agent.archive === "archived"
              ? !restoreAvailable
                ? txt.restoreUnavailable
                : undefined
              : mayWrite
                ? undefined
                : blockedReason,
          onArchive: () => {
            if (mayWrite) onArchive?.();
          },
          onRestore: () => onRestore?.(),
        }}
        workspaceLabel={workspaceName}
        workspaceHref={`/workspaces/${workspaceId}`}
        detailsExpanded={details}
        onToggleDetails={() => setDetails(!details)}
      />
      <ConversationStream streamRef={stream} onScroll={() => capture()}>
        {window?.next && state !== "error" ? (
          <div className="ah-history-pager">
            <Button
              data-testid="older-history"
              size="row"
              label={busy ? txt.loading : txt.loadOlder}
              pending={busy}
              onPress={loadMore}
            />
          </div>
        ) : null}
        {window?.cutOff && (
          <InlineNotice
            data-testid="history-cut-off"
            tone="warning"
            title={txt.cutOff}
            description={txt.cutOffDetail}
          />
        )}
        <TurnChangesRoot.Provider value={workspacePath}>
          <ConversationTimeline
            state={
              storagePressure.full &&
              ["stale", "error", "unavailable"].includes(state)
                ? entries.length
                  ? "ready"
                  : "loading"
                : state
            }
            items={timelineItems(
              entries,
              onLogin,
              agent.agent_id,
              window?.revision,
              undefined,
              undefined,
              undefined,
              undefined,
              agent.rest?.cause === "restart" && !!agent.interrupted_turn,
            )}
            historyMode="pagedAccessible"
            emptyLabel={txt.empty}
            onJumpToLatest={() => {}}
            problem={{
              title: txt.unavailable,
              description: txt.unavailableDetail,
            }}
          />
        </TurnChangesRoot.Provider>
        {agent.archive !== "archived" ? (
          <HelperRestoreNote agent={agent.agent_id} />
        ) : null}
      </ConversationStream>
      {actionError && (
        <InlineNotice
          data-testid="title-error"
          title={actionError}
          tone="warning"
        />
      )}
      {!recapDismissed && recap?.latest_message ? (
        <RecapCard
          recap={shownRecap}
          latestAt={recap.latest_message_at}
          now={recapNow}
          pending={false}
          error={false}
          unavailable
          unavailableReason={txt.recapNeedsContinue}
          onDismiss={() => setRecapDismissed(true)}
        />
      ) : null}
      {agent.archive === "archived" ? (
        <ArchivedFoot
          archivedAt={agent.archived_at}
          restoreReason={
            archiveAction({
              state: "archived",
              eligible: restoreAvailable,
              busy: archiveBusy,
              blockedReason: restoreAvailable
                ? undefined
                : txt.restoreUnavailable,
              onArchive: () => {},
              onRestore: () => {},
            }).reason || undefined
          }
          onRestore={() => onRestore?.()}
        >
          {helpersOn ? <ArchivedHelpers agent={agent.agent_id} /> : null}
        </ArchivedFoot>
      ) : (
        <div className="ah-read-only-footer">
          <div>
            <strong data-testid="read-only-indicator">{txt.readOnly}</strong>
            <p>
              {eligibility?.continuation === "writer_present"
                ? txt.writerBlocks
                : eligibility?.continuation === "history_damaged"
                  ? startProblemReason("history_damaged")
                  : eligibility?.continuation === "unproven"
                    ? txt.unproven
                    : txt.notFromBrowser}
            </p>
          </div>
          {/* A browser conversation is never continued from here: once it is
              visible again it opens with its composer, and Pi starts on send. */}
          <LinkRow
            data-testid="new-conversation-link"
            href={`/workspaces/${workspaceId}`}
            kind="inline"
          >
            {txt.newConversation}
          </LinkRow>
        </div>
      )}
      <BackgroundStrip ask={workerAsk} assets={assets} />
      {shell.panel}
    </ConversationFrame>
  );
}
